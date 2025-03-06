"""Load podcast transcript text files, clean up, split, ingest into Weaviate."""
import logging
import os
import re
import glob
from pathlib import Path

import weaviate
from constants import WEAVIATE_DOCS_INDEX_NAME
from langchain.document_loaders import TextLoader
from langchain.indexes import SQLRecordManager, index
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Weaviate
from langchain_core.embeddings import Embeddings
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_embeddings_model() -> Embeddings:
    return OpenAIEmbeddings(model="text-embedding-3-small", chunk_size=200)


def extract_title_from_filename(filepath: str) -> str:
    """Extract a readable title from the transcript filename."""
    filename = os.path.basename(filepath)
    # Remove extension
    filename = os.path.splitext(filename)[0]
    # Clean up common patterns in the filenames
    filename = filename.replace("(128kbit_AAC)", "").replace("(152kbit_Opus)", "")
    filename = filename.replace("_", " ").strip()
    return filename


def load_lectures_transcripts():
    """Load podcast transcript files from the transcripts directory."""
    transcript_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "transcripts")
    transcript_files = glob.glob(os.path.join(transcript_dir, "*.txt"))
    
    documents = []
    for file_path in transcript_files:
        try:
            # Extract metadata from filename
            title = extract_title_from_filename(file_path)
            
            # Load the content
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Create document with metadata
            doc = Document(
                page_content=content,
                metadata={
                    "source": file_path,
                    "title": title,
                }
            )
            documents.append(doc)
            
        except Exception as e:
            logger.error(f"Error loading transcript {file_path}: {e}")
    
    return documents


def ingest_docs():
    WEAVIATE_URL = os.environ["WEAVIATE_URL"]
    WEAVIATE_API_KEY = os.environ["WEAVIATE_API_KEY"]
    RECORD_MANAGER_DB_URL = os.environ["RECORD_MANAGER_DB_URL"]

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=200)
    embedding = get_embeddings_model()

    client = weaviate.Client(
        url=WEAVIATE_URL,
        auth_client_secret=weaviate.AuthApiKey(api_key=WEAVIATE_API_KEY),
    )
    vectorstore = Weaviate(
        client=client,
        index_name=WEAVIATE_DOCS_INDEX_NAME,
        text_key="text",
        embedding=embedding,
        by_text=False,
        attributes=["source", "title"],
    )

    record_manager = SQLRecordManager(
        f"weaviate/{WEAVIATE_DOCS_INDEX_NAME}", db_url=RECORD_MANAGER_DB_URL
    )
    record_manager.create_schema()

    lectures_transcripts = load_lectures_transcripts()
    logger.info(f"Loaded {len(lectures_transcripts)} podcast transcripts")

    docs_transformed = text_splitter.split_documents(lectures_transcripts)
    docs_transformed = [doc for doc in docs_transformed if len(doc.page_content) > 10]

    # We try to return 'source' and 'title' metadata when querying vector store and
    # Weaviate will error at query time if one of the attributes is missing from a
    # retrieved document.
    for doc in docs_transformed:
        if "source" not in doc.metadata:
            doc.metadata["source"] = ""
        if "title" not in doc.metadata:
            doc.metadata["title"] = ""

    indexing_stats = index(
        docs_transformed,
        record_manager,
        vectorstore,
        cleanup="full",
        source_id_key="source",
        force_update=(os.environ.get("FORCE_UPDATE") or "false").lower() == "true",
    )

    logger.info(f"Indexing stats: {indexing_stats}")
    num_vecs = client.query.aggregate(WEAVIATE_DOCS_INDEX_NAME).with_meta_count().do()
    logger.info(
        f"Cultural research lectures database now has this many vectors: {num_vecs}",
    )


if __name__ == "__main__":
    ingest_docs()

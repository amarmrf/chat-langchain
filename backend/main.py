"""Main entrypoint for the app."""
import asyncio
from typing import Optional, Union, List
from uuid import UUID

import langsmith
import weaviate
import os
from constants import WEAVIATE_DOCS_INDEX_NAME
from ingest import get_embeddings_model
from chain import ChatRequest, answer_chain
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langserve import add_routes
from langsmith import Client
from pydantic import BaseModel
from langchain_community.vectorstores import Weaviate

client = Client()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


add_routes(
    app,
    answer_chain,
    path="/chat",
    input_type=ChatRequest,
    config_keys=["metadata", "configurable", "tags"],
)


class SendFeedbackBody(BaseModel):
    run_id: UUID
    key: str = "user_score"

    score: Union[float, int, bool, None] = None
    feedback_id: Optional[UUID] = None
    comment: Optional[str] = None


@app.post("/feedback")
async def send_feedback(body: SendFeedbackBody):
    client.create_feedback(
        body.run_id,
        body.key,
        score=body.score,
        comment=body.comment,
        feedback_id=body.feedback_id,
    )
    return {"result": "posted feedback successfully", "code": 200}


class UpdateFeedbackBody(BaseModel):
    feedback_id: UUID
    score: Union[float, int, bool, None] = None
    comment: Optional[str] = None


@app.patch("/feedback")
async def update_feedback(body: UpdateFeedbackBody):
    feedback_id = body.feedback_id
    if feedback_id is None:
        return {
            "result": "No feedback ID provided",
            "code": 400,
        }
    client.update_feedback(
        feedback_id,
        score=body.score,
        comment=body.comment,
    )
    return {"result": "patched feedback successfully", "code": 200}


# TODO: Update when async API is available
async def _arun(func, *args, **kwargs):
    return await asyncio.get_running_loop().run_in_executor(None, func, *args, **kwargs)


async def aget_trace_url(run_id: str) -> str:
    for i in range(5):
        try:
            await _arun(client.read_run, run_id)
            break
        except langsmith.utils.LangSmithError:
            await asyncio.sleep(1**i)

    if await _arun(client.run_is_shared, run_id):
        return await _arun(client.read_run_shared_link, run_id)
    return await _arun(client.share_run, run_id)


class GetTraceBody(BaseModel):
    run_id: UUID


@app.post("/get_trace")
async def get_trace(body: GetTraceBody):
    run_id = body.run_id
    if run_id is None:
        return {
            "result": "No LangSmith run ID provided",
            "code": 400,
        }
    return await aget_trace_url(str(run_id))


class GetDocumentContentBody(BaseModel):
    document_id: str


class DocumentInfo(BaseModel):
    source: str
    title: str


@app.get("/list_documents")
async def list_documents(limit: int = 20):
    """Return a list of documents in the database for diagnostic purposes."""
    try:
        # Initialize Weaviate client
        WEAVIATE_URL = os.environ["WEAVIATE_URL"]
        WEAVIATE_API_KEY = os.environ["WEAVIATE_API_KEY"]
        
        weaviate_client = weaviate.Client(
            url=WEAVIATE_URL,
            auth_client_secret=weaviate.AuthApiKey(api_key=WEAVIATE_API_KEY),
        )
        
        # Get a list of unique documents by source and title
        results = weaviate_client.query.get(
            WEAVIATE_DOCS_INDEX_NAME, ["source", "title"]
        ).with_limit(limit).do()
        
        documents = results.get("data", {}).get("Get", {}).get(WEAVIATE_DOCS_INDEX_NAME, [])
        
        # Convert to a list of DocumentInfo objects
        document_list: List[DocumentInfo] = []
        seen_sources = set()
        
        for doc in documents:
            source = doc.get("source", "")
            if source and source not in seen_sources:
                seen_sources.add(source)
                document_list.append(
                    DocumentInfo(
                        source=source,
                        title=doc.get("title", "Untitled")
                    )
                )
        
        return {"documents": document_list, "count": len(document_list), "code": 200}
        
    except Exception as e:
        print(f"Error listing documents: {str(e)}")
        return {"documents": [], "error": str(e), "code": 500}


@app.post("/get_document_content")
async def get_document_content(body: GetDocumentContentBody):
    """Fetch document content from vector database using document_id."""
    document_id = body.document_id
    if not document_id:
        return {
            "result": "No document ID provided",
            "code": 400,
            "content": "No document ID provided"
        }
    
    try:
        # Initialize Weaviate client
        WEAVIATE_URL = os.environ["WEAVIATE_URL"]
        WEAVIATE_API_KEY = os.environ["WEAVIATE_API_KEY"]
        
        weaviate_client = weaviate.Client(
            url=WEAVIATE_URL,
            auth_client_secret=weaviate.AuthApiKey(api_key=WEAVIATE_API_KEY),
        )
        
        # Handle file paths - we might need to search by just the filename
        # or by the full path depending on how it was stored
        original_document_id = document_id
        
        # First, try with the exact document_id
        query = {
            "operator": "Equal",
            "path": ["source"],
            "valueString": document_id
        }
        
        # Use the weaviate_client directly to query
        results = weaviate_client.query.get(
            WEAVIATE_DOCS_INDEX_NAME, ["text", "source", "title"]
        ).with_where(query).with_limit(5).do()
        
        documents = results.get("data", {}).get("Get", {}).get(WEAVIATE_DOCS_INDEX_NAME, [])
        
        # If no results, try to extract the filename from the path and search for that
        if not documents and '/' in document_id:
            # Extract just the filename from the path
            filename = os.path.basename(document_id)
            
            # Try a more flexible search that might match the filename anywhere in the source path
            query = {
                "operator": "Like",
                "path": ["source"],
                "valueString": f"*{filename}*"
            }
            
            results = weaviate_client.query.get(
                WEAVIATE_DOCS_INDEX_NAME, ["text", "source", "title"]
            ).with_where(query).with_limit(5).do()
            
            documents = results.get("data", {}).get("Get", {}).get(WEAVIATE_DOCS_INDEX_NAME, [])
        
        if not documents:
            return {
                "content": f"Document not found for ID: {original_document_id}",
                "code": 404
            }
        
        # Combine text from all chunks with the same source
        combined_content = "\n\n".join([doc.get("text", "") for doc in documents])
        
        return {"content": combined_content, "code": 200}
        
    except Exception as e:
        print(f"Error retrieving document content: {str(e)}")
        return {"content": f"Error retrieving document: {str(e)}", "code": 500}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)

import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Link,
  Heading,
  Text,
  Box,
  Flex,
  Divider,
  Spinner,
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { Source } from "./SourceBubble";

// Function to clean up the source title by removing breadcrumbs and numbers
const cleanSourceTitle = (title: string): string => {
  // Remove phrases like "[English (auto-generated)]", "DownSub.com" and numbers like "(1)"
  return title
    .replace(/\[\s*English\s*\(auto-generated\)\s*\]/gi, '')
    .replace(/\[DownSub\.com\]/gi, '')
    .replace(/\(\d+\)$/g, '')
    .replace(/DownSub\.com/gi, '')
    .trim();
};

interface DocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  source: Source;
  content?: string;
  description?: string;
}

export function DocumentDialog({
  isOpen,
  onClose,
  source,
  content = "",
  description = "",
}: DocumentDialogProps) {
  const [transcriptContent, setTranscriptContent] = useState<string>(content);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Update transcriptContent when content prop changes
    if (content) {
      setTranscriptContent(content);
    }
  }, [content]);

  useEffect(() => {
    const fetchTranscriptContent = async () => {
      if (isOpen && source.url && !transcriptContent) {
        setIsLoading(true);
        try {
          // Extract the path from the source URL
          const filePath = source.url;
          
          // Read the file content directly, skipping if it's already loaded
          if (filePath && filePath.endsWith('.txt')) {
            const response = await fetch(filePath);
            if (response.ok) {
              const textContent = await response.text();
              setTranscriptContent(textContent);
            } else {
              console.error("Failed to load transcript content");
              setTranscriptContent("Failed to load transcript content");
            }
          }
        } catch (error) {
          console.error("Error loading transcript:", error);
          setTranscriptContent("Error loading transcript content");
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchTranscriptContent();
  }, [isOpen, source.url, transcriptContent]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="4xl" 
      scrollBehavior="inside"
      isCentered
    >
      <ModalOverlay />
      <ModalContent 
        bg="rgb(38, 38, 41)" 
        color="white" 
        maxH="80vh"
        minH="50vh"
      >
        <ModalHeader>
          <Flex justifyContent="space-between" alignItems="center">
            <Heading size="md" color="white">
              {cleanSourceTitle(source.title)}
            </Heading>
            {source.url && !source.url.includes("[") && (
              <Link 
                href={source.url} 
                isExternal 
                color="blue.300"
                display="flex"
                alignItems="center"
              >
                Source <ExternalLinkIcon mx="2px" />
              </Link>
            )}
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {description && description.trim() !== "" && (
            <>
              <Text color="gray.300" mb={3}>
                {description}
              </Text>
              <Divider mb={3} />
            </>
          )}
          <Box>
            {isLoading ? (
              <Flex justify="center" align="center" my={10}>
                <Spinner size="lg" />
              </Flex>
            ) : (
              <Text whiteSpace="pre-wrap" fontSize="sm">
                {transcriptContent || "Transcript content not available."}
              </Text>
            )}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
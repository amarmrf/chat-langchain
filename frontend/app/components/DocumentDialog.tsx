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
  Button,
} from "@chakra-ui/react";
import { ExternalLinkIcon, RepeatIcon } from "@chakra-ui/icons";
import { Source } from "./SourceBubble";
import { apiBaseUrl } from "../utils/constants";

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
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    // Update transcriptContent when content prop changes
    if (content) {
      setTranscriptContent(content);
    }
  }, [content]);

  const fetchTranscriptContent = async (forceRefresh = false) => {
    if ((isOpen && source.url && (!transcriptContent || forceRefresh)) || retryCount > 0) {
      setIsLoading(true);
      setErrorMessage("");
      try {
        // Fetch content from the vector database using the API
        const response = await fetch(`${apiBaseUrl}/get_document_content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ document_id: source.url }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.content) {
            setTranscriptContent(data.content);
            setErrorMessage("");
          } else {
            console.error("Invalid response format:", data);
            setErrorMessage("Error: Could not load content from the database.");
          }
        } else {
          console.error("Failed to load transcript content, status:", response.status);
          
          // If it's a 404, try one more time with just the filename
          if (response.status === 404 && source.url.includes('/')) {
            const filename = source.url.split('/').pop();
            if (filename) {
              console.log("Trying with filename only:", filename);
              const retryResponse = await fetch(`${apiBaseUrl}/get_document_content`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ document_id: filename }),
              });
              
              if (retryResponse.ok) {
                const data = await retryResponse.json();
                if (data && data.content) {
                  setTranscriptContent(data.content);
                  setErrorMessage("");
                  setIsLoading(false);
                  return;
                }
              }
            }
          }
          
          setErrorMessage(`Failed to load transcript content (Status: ${response.status})`);
        }
      } catch (error) {
        console.error("Error loading transcript:", error);
        setErrorMessage(`Error loading transcript: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
        setRetryCount(0);
      }
    }
  };

  useEffect(() => {
    fetchTranscriptContent();
  }, [isOpen, source.url, retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

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
            <Flex>
              <Button 
                leftIcon={<RepeatIcon />} 
                size="sm"
                colorScheme="blue"
                variant="ghost"
                mr={3}
                onClick={() => fetchTranscriptContent(true)}
                isLoading={isLoading}
              >
                Refresh
              </Button>
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
            ) : errorMessage ? (
              <Flex direction="column" align="center" my={5}>
                <Text color="red.300" mb={3}>{errorMessage}</Text>
                <Button size="sm" leftIcon={<RepeatIcon />} onClick={handleRetry}>
                  Retry
                </Button>
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
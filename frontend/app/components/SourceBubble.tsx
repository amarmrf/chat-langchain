import { useState, useEffect } from "react";
import "react-toastify/dist/ReactToastify.css";
import { Card, CardBody, Heading, Text, Flex, Box, Divider } from "@chakra-ui/react";
import { sendFeedback } from "../utils/sendFeedback";
import { DocumentDialog } from "./DocumentDialog";

export type Source = {
  url: string;
  title: string;
};

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

// Truncate text with ellipsis if it exceeds maxLength
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export function SourceBubble({
  source,
  highlighted,
  onMouseEnter,
  onMouseLeave,
  runId,
}: {
  source: Source;
  highlighted: boolean;
  onMouseEnter: () => any;
  onMouseLeave: () => any;
  runId?: string;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [snippetContent, setSnippetContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch content for snippet preview
  useEffect(() => {
    const fetchSnippetContent = async () => {
      if (source.url && !snippetContent) {
        setIsLoading(true);
        try {
          const filePath = source.url;
          
          if (filePath && filePath.endsWith('.txt')) {
            const response = await fetch(filePath);
            if (response.ok) {
              const textContent = await response.text();
              setSnippetContent(textContent);
            }
          }
        } catch (error) {
          console.error("Error loading snippet:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchSnippetContent();
  }, [source.url, snippetContent]);

  const handleCardClick = async () => {
    setIsDialogOpen(true);
    if (runId) {
      await sendFeedback({
        key: "user_click",
        runId,
        value: source.url,
        isExplicit: false,
      });
    }
  };

  // Get clean and truncated title
  const title = truncateText(cleanSourceTitle(source.title), 40);

  return (
    <>
      <Card
        onClick={handleCardClick}
        backgroundColor={highlighted ? "rgb(58, 58, 61)" : "rgb(78,78,81)"}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        cursor={"pointer"}
        alignSelf={"stretch"}
        height="100%"
        overflow={"hidden"}
      >
        <CardBody p={3}>
          <Flex direction="column" height="100%">
            <Heading size={"sm"} fontWeight={"normal"} color={"white"} mb={2}>
              {title}
            </Heading>
            
            <Divider my={2} borderColor="gray.600" />
            
            <Box mt={1} flex="1">
              {!isLoading && snippetContent && (
                <Text fontSize="xs" color="gray.300" noOfLines={3}>
                  {truncateText(snippetContent, 150)}
                </Text>
              )}
              {isLoading && (
                <Text fontSize="xs" color="gray.400">Loading...</Text>
              )}
              {!isLoading && !snippetContent && (
                <Text fontSize="xs" color="gray.400">No preview available</Text>
              )}
            </Box>
          </Flex>
        </CardBody>
      </Card>
      
      <DocumentDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        source={source}
        content={snippetContent}
        description="View full documentation source"
      />
    </>
  );
}

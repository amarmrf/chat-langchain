import React from "react";
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
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { Source } from "./SourceBubble";

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
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="rgb(38, 38, 41)" color="white">
        <ModalHeader>
          <Flex justifyContent="space-between" alignItems="center">
            <Heading size="md" color="white">
              {source.title}
            </Heading>
            <Link 
              href={source.url} 
              isExternal 
              color="blue.300"
              display="flex"
              alignItems="center"
            >
              Source <ExternalLinkIcon mx="2px" />
            </Link>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {description && (
            <>
              <Text color="gray.300" mb={3}>
                {description}
              </Text>
              <Divider mb={3} />
            </>
          )}
          <Box>
            <Text whiteSpace="pre-wrap">
              {content}
            </Text>
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
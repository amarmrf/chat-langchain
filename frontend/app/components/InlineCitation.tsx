import { useState } from "react";
import { Source } from "./SourceBubble";
import { DocumentDialog } from "./DocumentDialog";

export function InlineCitation(props: {
  source: Source;
  sourceNumber: number;
  highlighted: boolean;
  onMouseEnter: () => any;
  onMouseLeave: () => any;
}) {
  const { source, sourceNumber, highlighted, onMouseEnter, onMouseLeave } = props;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setIsDialogOpen(true)}
        className={`relative bottom-1.5 text-xs border rounded px-1 ${
          highlighted ? "bg-[rgb(58,58,61)]" : "bg-[rgb(78,78,81)]"
        }`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {sourceNumber + 1}
      </button>
      
      <DocumentDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        source={source}
        description="View full documentation source"
      />
    </>
  );
}

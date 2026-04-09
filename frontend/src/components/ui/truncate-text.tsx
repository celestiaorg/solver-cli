import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const MAX_LENGTH = 20;

export const TruncatedText = ({
  text,
  maxLength = MAX_LENGTH,
}: {
  text: string;
  maxLength?: number;
}) => {
  if (text.length > maxLength) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{text.slice(0, maxLength) + '...'}</span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-80 overflow-auto text-center whitespace-pre-wrap text-black"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    );
  }

  return <>{text}</>;
};

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

import { GenericFallbackIcon } from "../../icons";

export const ToastIcons = ({
  sourceChainImg,
  destinationChainImg,
}: {
  sourceChainImg: string | undefined;
  destinationChainImg: string | undefined;
}) => {
  return (
    <div className="relative flex w-14 items-center [&>*]:shrink-0">
      <Avatar className="size-9">
        <AvatarImage src={sourceChainImg} />
        <AvatarFallback>
          <GenericFallbackIcon className="size-9" />
        </AvatarFallback>
      </Avatar>
      <Avatar className="absolute top-0 right-0 size-9 border-0">
        <AvatarImage src={destinationChainImg} />
        <AvatarFallback>
          <GenericFallbackIcon className="size-9" />
        </AvatarFallback>
      </Avatar>
    </div>
  );
};

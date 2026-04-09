import { useEffect, useState } from 'react';

import { AvatarImage } from '@/components/ui/avatar';

export function AsyncAvatarImage({
  src,
  ...otherProps
}: Omit<React.ComponentProps<typeof AvatarImage>, 'src'> & {
  src: Promise<string> | string;
}) {
  const [image, setImage] = useState<string>();

  useEffect(() => {
    if (typeof src === 'string') {
      setImage(src);
    } else {
      src.then(setImage);
    }
  }, [src]);

  return <AvatarImage src={image} {...otherProps} />;
}

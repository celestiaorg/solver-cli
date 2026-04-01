import { edenImages } from '@/lib/constants/eden-images';

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      className={`relative flex min-h-dvh flex-col bg-cover bg-center px-10 py-14 md:p-10`}
      style={{ backgroundImage: `url(${edenImages.image1})` }}
    >
      {children}
    </div>
  );
};

export default Layout;

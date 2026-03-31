import Link from 'next/link';

import { Button } from '@/components/ui/button';

import { routes } from '@/utils/routes';

const NotFoundPage = () => {
  return (
    <>
      <main className="wrapper flex flex-1 flex-col justify-center gap-2">
        <header className="mx-auto flex items-center justify-center gap-2 text-[6.25rem] leading-34 font-bold md:text-[8.75rem] md:leading-47">
          404
        </header>

        <section className="flex flex-col gap-5 text-center">
          <h2 className="text-2xl font-bold md:text-[2.5rem]">
            This page could not be found
          </h2>
          <p className="text-muted-foreground text-sm md:text-xl">
            It may have been moved, removed or <br className="md:hidden" />
            the URL wasn&apos;t quite right.
          </p>
        </section>

        <footer className="mx-auto mt-6 w-72 max-w-full md:mt-8">
          <Button size="lg" asChild className="w-full rounded-full">
            <Link href={routes.home}>Visit the homepage</Link>
          </Button>
        </footer>
      </main>
    </>
  );
};

export default NotFoundPage;

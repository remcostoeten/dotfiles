import type { Route } from './+types/page';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import { source } from '@/source';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { executeMdxSync } from '@fumadocs/mdx-remote/client';
import type { PageTree } from 'fumadocs-core/server';
import { createCompiler } from '@fumadocs/mdx-remote';
import * as path from 'node:path';
import { useState } from 'react';
import { CommandPalette } from '../components/command-palette';
import { ReadingProgress } from '../components/reading-progress';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { useEnvironment } from '../hooks/use-environment';
import { PlatformBadge } from '../components/platform-badge';
import { CopyButton } from '../components/copy-button';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}
const compiler = createCompiler({
  development: false,
});

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = params['*'].split('/').filter((v) => v.length > 0);
  const page = source.getPage(slugs);
  if (!page) throw new Error('Not found');

  const compiled = await compiler.compileFile({
    path: path.resolve('content/docs', page.file.path),
    value: page.data.content,
  });

  return {
    page,
    compiled: compiled.toString(),
    tree: source.pageTree,
  };
}

export default function Page(props: Route.ComponentProps) {
  const { page, compiled, tree } = props.loaderData;
  const { default: Mdx, toc } = executeMdxSync(compiled);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const environment = useEnvironment();

  // Enhanced MDX components with copy buttons
  const enhancedComponents = {
    ...defaultMdxComponents,
    pre: ({ children, ...props }: any) => {
      const code = children?.props?.children || '';
      return (
        <div className="relative">
          <pre {...props}>
            {children}
            <CopyButton text={code} />
          </pre>
        </div>
      );
    },
    // Add platform badges
    PlatformBadge: ({ platform }: { platform: 'linux' | 'macos' | 'cross-platform' }) => (
      <PlatformBadge platform={platform} />
    ),
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'k',
      metaKey: true,
      callback: () => setIsCommandPaletteOpen(true),
    },
    {
      key: 'k',
      ctrlKey: true,
      callback: () => setIsCommandPaletteOpen(true),
    },
  ]);

  return (
    <>
      <ReadingProgress />
      <DocsLayout
        nav={{
          title: 'Dotfiles Documentation',
          children: (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
                title="Search documentation (Ctrl+K)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline px-1.5 py-0.5 bg-background rounded text-xs border">
                  {environment.platform === 'macos' ? '⌘' : 'Ctrl'}K
                </kbd>
              </button>
            </div>
          ),
        }}
        tree={tree as PageTree.Root}
      >
        <DocsPage toc={toc}>
          <div className="flex items-center gap-2 mb-4">
            <DocsTitle>{page.data.title}</DocsTitle>
            {/* Auto-detect and show platform badges */}
            {environment.platform === 'linux' && <PlatformBadge platform="linux" />}
            {environment.platform === 'macos' && <PlatformBadge platform="macos" />}
            {environment.platform === 'windows' && <PlatformBadge platform="cross-platform" />}
          </div>
          <DocsDescription>{page.data.description}</DocsDescription>
          <DocsBody>
            <Mdx components={enhancedComponents} />
          </DocsBody>
        </DocsPage>
      </DocsLayout>
      
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </>
  );
}

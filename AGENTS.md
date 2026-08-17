# SLM - Simple Logo Maker
as the name says it should be a simple logo maker.

# Guidelines for Agents
- **Tech Stack**: Built with TanStack Start, React 19, TypeScript, Tailwind CSS, and Vite.
- **Package Manager**: Use `bun` for package management and running scripts (`bun install`, `bun dev`, `bun build`, `bun lint`).
- **Styling**: Tailwind CSS v4 and shadcn/ui components in `src/components/ui`.
- **Routing**: TanStack Start file-based routing in `src/routes/`.

## Code Style
Our main goal is to write clean, maintainable, and performant code. so it should be small, easy to read and most importantly not bloated. Every UI change must keep in mind that the website is made for mobile devices as well and it's a must to keep accessibility in mind all the time.
other stuff:
- We don't need Emojis and Em dashes in the code.
- Follow TypeScript best practices and use type annotations where appropriate.
- Use Tailwind CSS v4 for styling.
- Follow React best practices and use hooks where appropriate.


## Must do after editing code
- **Type Check**: `bun x tsc --noEmit`
- **Run Linting**: `bun lint`
- **Format Code**: `bun format`
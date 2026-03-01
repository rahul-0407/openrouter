import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import './globals.css'
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const metadata = {
  title: {
    default: 'OpenRouter Docs',
    template: '%s — OpenRouter',
  },
  description: 'Developer documentation for the OpenRouter LLM gateway',
}

export default async function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={
            <Navbar
              logo={<b>OpenRouter</b>}
              projectLink="https://github.com/rahul-0407/openrouter"
            />
          }
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/rahul-0407/openrouter/tree/main/apps/docs"
          footer={<Footer>MIT {new Date().getFullYear()} © OpenRouter</Footer>}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}

import { RawHtml } from "static-jsx";

export default function render({ children, nav, page, title, today }) {
  return (
    <>
      {new RawHtml("<!DOCTYPE html>")}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link
            href="https://fonts.googleapis.com/css2?family=Inconsolata&family=Open+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
            rel="stylesheet"
          />
          <link href="/css/index.css" rel="stylesheet" />
          <link href="/css/prism-theme.css" rel="stylesheet" />
          <link rel="icon" type="image/png" href="/favicon.png" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
        </head>
        <body>
          <nav>
            <ul>
              {nav.map((link) => (
                <li>
                  {link.href !== page.url ? (
                    <a href={link.href}>{link.text}</a>
                  ) : (
                    link.text
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <main>{children}</main>

          <footer>
            © 2020–{today.getUTCFullYear()} Ian Johnson{" "}
            <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">
              (CC BY 4.0)
            </a>
            <a rel="me" href="https://mstdn.social/@ianprime0509">
              <img src="/img/mastodon-logo.svg" alt="Mastodon" class="invert-dark" />
            </a>
          </footer>
        </body>
      </html>
    </>
  );
}

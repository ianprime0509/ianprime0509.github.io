import { RawHtml } from "static-jsx";

export default function render({ children, nav, page, title, today }) {
  return (
    <>
      {new RawHtml("<!DOCTYPE html>")}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
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
            Written by Ian Johnson{" "}
            <a
              rel="license"
              href="https://creativecommons.org/publicdomain/zero/1.0/"
            >
              (CC0-1.0)
            </a>
            <span class="sep" />
            <a href="mailto:ian@ianjohnson.dev">
              <img
                src="/img/envelope-solid.svg"
                alt="Email"
                class="invert-dark"
              />
            </a>
            <a rel="me" href="https://mstdn.social/@ianprime0509">
              <img
                src="/img/mastodon-logo.svg"
                alt="Mastodon"
                class="invert-dark"
              />
            </a>
          </footer>
        </body>
      </html>
    </>
  );
}

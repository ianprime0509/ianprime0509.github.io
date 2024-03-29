export const data = {
  layout: "layouts/main.jsx",
};

export default function render({ children, title }) {
  return (
    <>
      <header>
        <h1>{title}</h1>
      </header>

      <article>{children}</article>
    </>
  );
}

import PostList from "./_includes/PostList.jsx";

export const data = {
  title: "Ian Johnson",
  layout: "layouts/main.jsx",
};

export default function render({ collections }) {
  return (
    <>
      <header>
        <h1>Ian Johnson</h1>

        <img class="rounded small" src="img/me.jpg" alt="A picture of me" />

        <p>
          I am a software developer. I mainly work in Java professionally, but
          enjoy experimenting with different technologies outside work. You can
          explore several of my <a href="/projects/">personal projects</a> on
          this site or read some <a href="/posts/">things I've written</a>.
        </p>
      </header>

      <section>
        <h1>Recent posts</h1>

        <PostList
          formatDate={this.isoDate}
          posts={this.lastN(collections.posts, 5)}
        />
      </section>
    </>
  );
}

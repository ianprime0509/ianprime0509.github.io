import PostList from "./_includes/PostList.jsx";

export const data = {
  layout: "layouts/main.jsx",
  title: "Posts",
};

export function render({ collections }) {
  return (
    <>
      <header>
        <h1>Posts</h1>
      </header>

      <PostList
        formatDate={this.isoDate}
        posts={this.lastN(collections.posts, 20)}
      />
    </>
  );
}

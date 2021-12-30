export default function PostList({ formatDate, posts }) {
  return (
    <ol class="post-list">
      {posts.reverse().map((post) => (
        <li>
          <a href={post.url}>{post.data.title}</a>
          <time datetime={formatDate(post.date)}>{formatDate(post.date)}</time>
        </li>
      ))}
    </ol>
  );
}

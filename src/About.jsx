import { Link } from "react-router";

function About() {
  return (
    <div className="aboutPage">
      <header className="aboutHeader">
        <Link className="brand" to="/">
          Photo Gallery
        </Link>
      </header>

      <main className="aboutContent">
        <h1>About</h1>

        <p>
          Photo Gallery is a private place to preserve, organize, and revisit
          the photographs that matter most to you.
        </p>

        <Link className="backLink" to="/">
          Back to Gallery
        </Link>
      </main>
    </div>
  );
}

export default About;
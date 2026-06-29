import { useState } from "react";
import "./App.css";

function App() {
  const [photos, setPhotos] = useState([]);

  function addPhotos(event) {
    const selectedFiles = Array.from(event.target.files);

    const newPhotos = selectedFiles.map((file) => {
      return {
        name: file.name,
        url: URL.createObjectURL(file),
      };
    });

    setPhotos([...photos, ...newPhotos]);
  }

  return (
    <div className="app">
      <header className="topBar">
        <div>
          <h1>My Photo Board</h1>
          <p>Add photos and turn them into a Pinterest-style gallery.</p>
        </div>

        <label className="uploadButton">
          Add Photos
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={addPhotos}
          />
        </label>
      </header>

      {photos.length === 0 ? (
        <section className="emptyState">
          <h2>No photos yet</h2>
          <p>Click “Add Photos” to choose pictures from your computer.</p>
        </section>
      ) : (
        <section className="gallery">
          {photos.map((photo, index) => (
            <div className="photoCard" key={index}>
              <img src={photo.url} alt={photo.name} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default App;

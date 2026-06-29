import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  async function loadPhotos() {
    const response = await fetch("/api/photos");
    const savedPhotos = await response.json();
    setPhotos(savedPhotos);
  }

  async function addPhotos(event) {
    const selectedFiles = Array.from(event.target.files);

    if (selectedFiles.length === 0) {
      return;
    }

    setUploading(true);

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("photo", file);

      await fetch("/api/photos", {
        method: "POST",
        body: formData,
      });
    }

    await loadPhotos();
    setUploading(false);
    event.target.value = "";
  }

  async function deletePhoto(id) {
    await fetch(`/api/photos/${id}`, {
      method: "DELETE",
    });

    await loadPhotos();
  }

  useEffect(() => {
    loadPhotos();
  }, []);

  return (
    <div className="app">
      <header className="topBar">
        <div>
          <h1>My Photo Board</h1>
          <p>Your saved Pinterest-style gallery.</p>
        </div>

        <label className="uploadButton">
          {uploading ? "Uploading..." : "Add Photos"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={addPhotos}
          />
        </label>
      </header>

      {photos.length === 0 ? (
        <section className="emptyState">
          <h2>No photos yet</h2>
          <p>Add photos and they will stay saved after refresh.</p>
        </section>
      ) : (
        <section className="gallery">
          {photos.map((photo) => (
            <div className="photoCard" key={photo.id}>
              <img src={photo.imageUrl} alt={photo.filename} />

              <button
                className="deleteButton"
                onClick={() => deletePhoto(photo.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default App;
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  async function getAuthHeaders() {
    if (!user) return {};
    const token = await user.getIdToken();

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  async function loadPhotos(currentUser = user) {
    if (!currentUser) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const token = await currentUser.getIdToken();

    const response = await fetch("/api/photos", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    const savedPhotos = await response.json();

    if (Array.isArray(savedPhotos)) {
      setPhotos(savedPhotos);
    } else {
      setPhotos([]);
    }

    setLoading(false);
  }

  async function handleSignIn() {
    await signInWithPopup(auth, googleProvider);
  }

  async function handleSignOut() {
    await signOut(auth);
    setPhotos([]);
  }

  async function addPhotos(event) {
    const selectedFiles = Array.from(event.target.files);

    if (!user || selectedFiles.length === 0) {
      return;
    }

    setUploading(true);

    const headers = await getAuthHeaders();

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("photo", file);

      await fetch("/api/photos", {
        method: "POST",
        headers,
        body: formData,
      });
    }

    await loadPhotos();
    setUploading(false);
    event.target.value = "";
  }

  async function deletePhoto(id) {
    const headers = await getAuthHeaders();

    await fetch(`/api/photos/${id}`, {
      method: "DELETE",
      headers,
    });

    await loadPhotos();
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      loadPhotos(currentUser);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="app">Loading...</div>;
  }

  return (
    <div className="app">
      <header className="topBar">
        <div>
          <h1>My Photo Board</h1>
          <p>Your private Pinterest-style gallery.</p>
        </div>

        <div className="actions">
          {user ? (
            <>
              <span className="userEmail">{user.email}</span>

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

              <button className="secondaryButton" onClick={handleSignOut}>
                Sign Out
              </button>
            </>
          ) : (
            <button className="uploadButton" onClick={handleSignIn}>
              Sign In With Google
            </button>
          )}
        </div>
      </header>

      {!user ? (
        <section className="emptyState">
          <h2>Sign in to see your photos</h2>
          <p>Your photos will be saved privately to your account.</p>
        </section>
      ) : photos.length === 0 ? (
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


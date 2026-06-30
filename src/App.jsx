import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import "./App.css";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

async function compressImageUnder8MB(file) {
  if (file.size <= MAX_IMAGE_SIZE) {
    return file;
  }

  const image = await loadImageFromFile(file);

  let width = image.width;
  let height = image.height;
  let quality = 0.85;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  let compressedBlob = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    canvas.width = width;
    canvas.height = height;

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    compressedBlob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (compressedBlob && compressedBlob.size <= MAX_IMAGE_SIZE) {
      break;
    }

    quality -= 0.08;

    if (quality < 0.45) {
      width = Math.round(width * 0.85);
      height = Math.round(height * 0.85);
      quality = 0.8;
    }
  }

  URL.revokeObjectURL(image.src);

  if (!compressedBlob || compressedBlob.size > MAX_IMAGE_SIZE) {
    throw new Error(`${file.name} could not be compressed under 8 MB`);
  }

  const cleanName = file.name.replace(/\.[^/.]+$/, "");

  return new File([compressedBlob], `${cleanName}.jpg`, {
    type: "image/jpeg",
  });
}

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

    try {
      const headers = await getAuthHeaders();

      for (const file of selectedFiles) {
        if (!file.type.startsWith("image/")) {
          continue;
        }

        const finalFile = await compressImageUnder8MB(file);

        const formData = new FormData();
        formData.append("photo", finalFile);

        const response = await fetch("/api/photos", {
          method: "POST",
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText);
        }
      }

      await loadPhotos();
    } catch (error) {
      alert(error.message || "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
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


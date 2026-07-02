import { useEffect, useState } from "react";
import { Link } from "react-router";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { compressImageUnder8MB } from "./imageCompression";
import "./Albums.css";

function Albums() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [albums, setAlbums] = useState([]);
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [albumName, setAlbumName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function authHeaders(currentUser = user) {
    const token = await currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }

  async function readError(response) {
    const data = await response.json().catch(() => ({}));
    return data.error || "Something went wrong";
  }

  async function loadAlbums(currentUser = user, preferredAlbumId) {
    if (!currentUser) return;
    const response = await fetch("/api/albums", {
      headers: await authHeaders(currentUser),
    });

    if (!response.ok) throw new Error(await readError(response));
    const nextAlbums = await response.json();
    setAlbums(nextAlbums);

    const nextId = preferredAlbumId || activeAlbum?.id || nextAlbums[0]?.id;
    if (nextId) await openAlbum(nextId, currentUser, nextAlbums);
    else {
      setActiveAlbum(null);
      setPhotos([]);
    }
  }

  async function openAlbum(albumId, currentUser = user, albumList = albums) {
    setBusy(true);
    setMessage("");

    try {
      const headers = await authHeaders(currentUser);
      const response = await fetch(`/api/albums/${albumId}/photos`, { headers });
      if (!response.ok) throw new Error(await readError(response));

      const data = await response.json();
      const photosWithImages = await Promise.all(
        data.photos.map(async (photo) => {
          const imageResponse = await fetch(photo.imageUrl, { headers });
          if (!imageResponse.ok) return { ...photo, displayUrl: "" };
          return {
            ...photo,
            displayUrl: URL.createObjectURL(await imageResponse.blob()),
          };
        })
      );

      setActiveAlbum(
        albumList.find((album) => album.id === albumId) || data.album
      );
      setPhotos((current) => {
        current.forEach((photo) => {
          if (photo.displayUrl) URL.revokeObjectURL(photo.displayUrl);
        });
        return photosWithImages;
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function createAlbum(event) {
    event.preventDefault();
    if (!albumName.trim()) return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: albumName }),
      });

      if (!response.ok) throw new Error(await readError(response));
      const album = await response.json();
      setAlbumName("");
      await loadAlbums(user, album.id);
      setMessage("Album created. Share its invite code with someone you trust.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinAlbum(event) {
    event.preventDefault();
    if (!inviteCode.trim()) return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/albums/join", {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inviteCode }),
      });

      if (!response.ok) throw new Error(await readError(response));
      const album = await response.json();
      setInviteCode("");
      await loadAlbums(user, album.id);
      setMessage(`You joined ${album.name}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhotos(event) {
    const files = Array.from(event.target.files || []);
    if (!activeAlbum || files.length === 0) return;
    setBusy(true);
    setMessage("");

    try {
      const headers = await authHeaders();

      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const finalFile = await compressImageUnder8MB(file);
        const formData = new FormData();
        formData.append("photo", finalFile);
        const response = await fetch(`/api/albums/${activeAlbum.id}/photos`, {
          method: "POST",
          headers,
          body: formData,
        });
        if (!response.ok) throw new Error(await readError(response));
      }

      await openAlbum(activeAlbum.id);
    } catch (error) {
      setMessage(error.message);
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  }

  async function deletePhoto(photo) {
    if (!window.confirm("Permanently delete this shared photo?")) return;
    setBusy(true);

    try {
      const response = await fetch(
        `/api/albums/${activeAlbum.id}/photos/${photo.id}`,
        { method: "DELETE", headers: await authHeaders() }
      );
      if (!response.ok) throw new Error(await readError(response));
      await openAlbum(activeAlbum.id);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadPhoto(photo) {
    if (!photo.displayUrl) return;
    const link = document.createElement("a");
    link.href = photo.displayUrl;
    link.download = photo.filename || "shared-photo";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function copyInviteCode() {
    await navigator.clipboard.writeText(activeAlbum.invite_code);
    setMessage("Invite code copied.");
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        try {
          await loadAlbums(currentUser);
        } catch (error) {
          setMessage(error.message);
        }
      } else {
        setAlbums([]);
        setActiveAlbum(null);
        setPhotos([]);
      }
    });
    // Firebase owns this lifecycle; rerunning the effect would duplicate observers.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authLoading) return <div className="albumsLoading">Loading...</div>;

  return (
    <div className="albumsPage">
      <header className="albumsHeader">
        <Link className="brand" to="/">Photo Gallery</Link>
        <nav>
          <Link to="/">Gallery</Link>
          <Link to="/about">About</Link>
        </nav>
        {user ? (
          <button className="albumSecondaryButton" onClick={() => signOut(auth)}>
            Sign Out
          </button>
        ) : (
          <button
            className="albumPrimaryButton"
            onClick={() => signInWithPopup(auth, googleProvider)}
          >
            Sign In With Google
          </button>
        )}
      </header>

      {!user ? (
        <main className="albumsSignedOut">
          <p>Shared albums</p>
          <h1>One album, everyone&apos;s photographs.</h1>
          <button
            className="albumPrimaryButton"
            onClick={() => signInWithPopup(auth, googleProvider)}
          >
            Sign In With Google
          </button>
        </main>
      ) : (
        <main className="albumsLayout">
          <aside className="albumsSidebar">
            <div className="sidebarHeading">
              <h1>Albums</h1>
              <span>{albums.length}</span>
            </div>

            <form className="albumForm" onSubmit={createAlbum}>
              <label htmlFor="album-name">Create an album</label>
              <div>
                <input
                  id="album-name"
                  value={albumName}
                  maxLength={80}
                  placeholder="Album name"
                  onChange={(event) => setAlbumName(event.target.value)}
                />
                <button disabled={busy}>Create</button>
              </div>
            </form>

            <form className="albumForm" onSubmit={joinAlbum}>
              <label htmlFor="invite-code">Join with a code</label>
              <div>
                <input
                  id="invite-code"
                  value={inviteCode}
                  maxLength={8}
                  placeholder="Invite code"
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                />
                <button disabled={busy}>Join</button>
              </div>
            </form>

            <div className="albumList">
              {albums.map((album) => (
                <button
                  key={album.id}
                  className={activeAlbum?.id === album.id ? "active" : ""}
                  onClick={() => openAlbum(album.id)}
                >
                  <strong>{album.name}</strong>
                  <span>{album.photo_count} photos · {album.member_count} members</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="albumWorkspace">
            {message && <div className="albumMessage">{message}</div>}
            {!activeAlbum ? (
              <div className="albumEmpty">
                <h2>Create or join an album</h2>
              </div>
            ) : (
              <>
                <div className="activeAlbumHeader">
                  <div>
                    <p>Shared album</p>
                    <h2>{activeAlbum.name}</h2>
                  </div>
                  <div className="albumHeaderActions">
                    <button className="inviteCode" onClick={copyInviteCode}>
                      Code: {activeAlbum.invite_code}
                    </button>
                    <label className="albumPrimaryButton">
                      {busy ? "Working..." : "Add Photos"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={busy}
                        onChange={uploadPhotos}
                      />
                    </label>
                  </div>
                </div>

                {photos.length === 0 ? (
                  <div className="albumEmpty"><h2>No shared photos yet</h2></div>
                ) : (
                  <div className="sharedGallery">
                    {photos.map((photo) => (
                      <article className="sharedPhoto" key={photo.id}>
                        {photo.displayUrl ? (
                          <img src={photo.displayUrl} alt={photo.filename} />
                        ) : (
                          <div className="sharedImageError">Image unavailable</div>
                        )}
                        <div className="sharedPhotoActions">
                          <button onClick={() => downloadPhoto(photo)}>Download</button>
                          {photo.canDelete && (
                            <button className="sharedDelete" onClick={() => deletePhoto(photo)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

export default Albums;

import { useState } from "react";
import api, { errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import { fmtBytes, fmtDate, label, shortHash } from "../utils/format";

const CUSTODY_LABELS = {
  uploaded: "Uploaded",
  viewed: "Viewed",
  downloaded: "Downloaded",
  verified: "Integrity verified",
  tagged: "Tags changed",
  integrity_failed: "Integrity check failed",
};

export default function EvidencePanel({ incident, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const role = user.role;
  const canHandle = ["admin", "analyst", "responder"].includes(role);
  const canUpload = canHandle && incident.status !== "closed";
  const canVerify = ["admin", "analyst"].includes(role);

  const [files, setFiles] = useState([]);
  const [inputKey, setInputKey] = useState(0);
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [verify, setVerify] = useState({}); // evidenceId -> { intact, text }
  const [custody, setCustody] = useState(null); // { evidence, rows } | { evidence, loading }
  const [newTag, setNewTag] = useState({}); // evidenceId -> text

  async function upload(e) {
    e.preventDefault();
    if (!files.length) return toast.push("Choose at least one file to upload.", "error");
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (tags.trim()) fd.append("tags", tags);
    if (description.trim()) fd.append("description", description.trim());
    setUploading(true);
    try {
      const { data } = await api.post(`/incidents/${incident._id}/evidence`, fd);
      toast.push(`${data.count} file${data.count === 1 ? "" : "s"} uploaded and hashed`, "success");
      setFiles([]);
      setTags("");
      setDescription("");
      setInputKey((k) => k + 1);
      onChanged();
    } catch (err) {
      toast.push(errMsg(err), "error");
    } finally {
      setUploading(false);
    }
  }

  async function download(ev) {
    try {
      const res = await api.get(`/evidence/${ev._id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = ev.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.push("Download started. Integrity was checked first.", "success");
    } catch (err) {
      toast.push(errMsg(err), "error");
    }
  }

  async function verifyIntegrity(ev) {
    try {
      const { data } = await api.post(`/evidence/${ev._id}/verify`);
      setVerify((v) => ({
        ...v,
        [ev._id]: data.intact
          ? { intact: true, text: "Hash matches. File is unchanged." }
          : { intact: false, text: data.reason || "Hash does not match." },
      }));
    } catch (err) {
      toast.push(errMsg(err), "error");
    }
  }

  async function openCustody(ev) {
    setCustody({ evidence: ev, loading: true });
    try {
      const { data } = await api.get(`/evidence/${ev._id}/custody`);
      setCustody({ evidence: ev, rows: data.data });
    } catch (err) {
      setCustody(null);
      toast.push(errMsg(err), "error");
    }
  }

  async function changeTags(ev, body) {
    try {
      await api.patch(`/evidence/${ev._id}/tags`, body);
      setNewTag((t) => ({ ...t, [ev._id]: "" }));
      onChanged();
    } catch (err) {
      toast.push(errMsg(err), "error");
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.push("SHA-256 hash copied", "success");
    } catch (e) {
      toast.push("Could not copy. Select the hash in the custody log instead.", "error");
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Forensic evidence ({incident.evidence.length})</h2>
      </div>
      <div className="panel-body">
        {canUpload && (
          <form className="upload-box" onSubmit={upload}>
            <div className="field">
              <label htmlFor="ev-files">Add evidence files</label>
              <input id="ev-files" key={inputKey} type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
              <span className="hint">Up to 10 files per upload. Each file is hashed with SHA-256 the moment it arrives.</span>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="ev-tags">Tags</label>
                <input id="ev-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="logs, memory-dump, screenshot" />
              </div>
              <div className="field">
                <label htmlFor="ev-desc">Description</label>
                <input id="ev-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Where and how it was collected" />
              </div>
            </div>
            <button className="btn btn-primary" disabled={uploading}>{uploading ? "Uploading..." : "Upload evidence"}</button>
          </form>
        )}

        {incident.status === "closed" && <div className="notice" style={{ marginBottom: "1rem" }}>This incident is closed. Reopen it to add more evidence.</div>}

        {incident.evidence.length === 0 ? (
          <div className="empty"><strong>No evidence attached.</strong>{canUpload ? "Upload logs, screenshots or disk images above." : "Nothing has been uploaded for this incident."}</div>
        ) : (
          incident.evidence.map((ev) => (
            <div className="evidence-item" key={ev._id}>
              <div className="ev-top">
                <div>
                  <div className="ev-name">{ev.originalName}</div>
                  <div className="muted small">
                    {fmtBytes(ev.size)} &middot; uploaded by {ev.uploadedBy ? ev.uploadedBy.name : "unknown"} &middot; {fmtDate(ev.createdAt)}
                  </div>
                </div>
                <div className="btn-row">
                  {canHandle && <button className="btn btn-sm" onClick={() => download(ev)}>Download</button>}
                  {canVerify && <button className="btn btn-sm" onClick={() => verifyIntegrity(ev)}>Verify integrity</button>}
                  <button className="btn btn-sm" onClick={() => openCustody(ev)}>Custody log</button>
                </div>
              </div>

              {ev.description && <p className="small" style={{ marginTop: "0.4rem" }}>{ev.description}</p>}

              <div style={{ marginTop: "0.5rem" }}>
                <span className="hash" title={ev.sha256}>SHA-256 {shortHash(ev.sha256)}</span>{" "}
                <button className="link-btn small" onClick={() => copy(ev.sha256)}>Copy</button>
                {verify[ev._id] && (
                  <span className={`small ${verify[ev._id].intact ? "verify-ok" : "verify-bad"}`} style={{ marginLeft: "0.6rem" }}>
                    {verify[ev._id].text}
                  </span>
                )}
              </div>

              <div style={{ marginTop: "0.6rem" }}>
                {ev.tags.map((t) => (
                  <span className="chip" key={t}>
                    {t}
                    {canHandle && <button aria-label={`Remove tag ${t}`} onClick={() => changeTags(ev, { remove: [t] })}>&times;</button>}
                  </span>
                ))}
                {canHandle && (
                  <input
                    className="tag-input"
                    type="text"
                    placeholder="Add tag"
                    aria-label="Add tag"
                    value={newTag[ev._id] || ""}
                    onChange={(e) => setNewTag((t) => ({ ...t, [ev._id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (newTag[ev._id] || "").trim()) {
                        e.preventDefault();
                        changeTags(ev, { add: [newTag[ev._id]] });
                      }
                    }}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {custody && (
        <Modal wide title={`Chain of custody: ${custody.evidence.originalName}`} onClose={() => setCustody(null)}>
          <p className="small" style={{ marginBottom: "0.8rem" }}>
            Recorded SHA-256: <span className="hash" style={{ overflowWrap: "anywhere" }}>{custody.evidence.sha256}</span>
          </p>
          {custody.loading ? (
            <div className="spinner" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>When</th><th>Action</th><th>Who</th><th>IP address</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {custody.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="nowrap">{fmtDate(r.at)}</td>
                      <td className={r.action === "integrity_failed" ? "verify-bad" : ""}>{CUSTODY_LABELS[r.action] || label(r.action)}</td>
                      <td>{r.by ? `${r.by.name} (${r.by.role})` : "-"}</td>
                      <td className="mono">{r.ip || "-"}</td>
                      <td className="small" style={{ overflowWrap: "anywhere" }}>{r.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";

type ReviewStatus = "pending" | "approved" | "rejected";
type Review = {
  id: string;
  rating: number;
  title: string;
  quote: string;
  designation: string | null;
  publicConsent: boolean;
  displayNameConsent: boolean;
  status: ReviewStatus;
};
type ReviewForm = Omit<Review, "id" | "quote" | "status"> & { message: string };

const emptyReview: ReviewForm = {
  rating: 0,
  title: "",
  message: "",
  designation: "",
  publicConsent: false,
  displayNameConsent: false,
};

export function TestimonialForm() {
  const [review, setReview] = useState<Review | null>(null);
  const [form, setForm] = useState<ReviewForm>(emptyReview);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/testimonials/mine", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { testimonial?: Review | null; error?: string };
        if (!response.ok) throw new Error(result.error || "Your review could not be loaded.");
        if (!active) return;
        const current = result.testimonial ?? null;
        setReview(current);
        if (current) {
          setForm({
            rating: current.rating,
            title: current.title,
            message: current.quote,
            designation: current.designation ?? "",
            publicConsent: current.publicConsent,
            displayNameConsent: current.displayNameConsent,
          });
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Your review could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(review ? `/api/testimonials/${encodeURIComponent(review.id)}` : "/api/testimonials", {
        method: review ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json() as { testimonial?: Review; error?: string };
      if (!response.ok || !result.testimonial) throw new Error(result.error || "Your review could not be saved.");
      setReview(result.testimonial);
      setForm((current) => ({ ...current, rating: result.testimonial!.rating }));
      setNotice("Your review was submitted for moderation. It will not be public until approved.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your review could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeReview() {
    if (!review || !window.confirm("Delete your testimonial? This cannot be undone.")) return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/testimonials/${encodeURIComponent(review.id)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Your review could not be deleted.");
      setReview(null);
      setForm(emptyReview);
      setNotice("Your review has been deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Your review could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <section className="account-panel testimonial-form-panel" aria-busy="true"><p>Loading your review…</p></section>;
  }

  return (
    <section className="account-panel testimonial-form-panel">
      <header className="account-panel-heading">
        <span className="account-panel-icon" aria-hidden="true">★</span>
        <div>
          <h2>Share Your PrivSentinel Experience</h2>
          <p>Reviews are private until an administrator approves them.</p>
        </div>
      </header>
      {review && <p className={`review-status is-${review.status}`} role="status">
        Submission status: <strong>{review.status}</strong>
        {review.status === "approved" && !review.publicConsent ? " · Public display permission is off, so this review remains private." : ""}
      </p>}
      {error && <p className="account-message error" role="alert">{error}</p>}
      {notice && <p className="account-message success" role="status">{notice}</p>}
      <form className="review-form" onSubmit={(event) => void submit(event)}>
        <fieldset className="review-rating">
          <legend>Overall rating <span aria-hidden="true">*</span></legend>
          <div role="group" aria-label="Overall rating, five stars">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                type="button"
                key={rating}
                aria-label={`${rating} ${rating === 1 ? "star" : "stars"}`}
                aria-pressed={form.rating === rating}
                className={rating <= form.rating ? "is-selected" : ""}
                onClick={() => setForm((current) => ({ ...current, rating }))}
              >★</button>
            ))}
          </div>
        </fieldset>
        <label>Testimonial title
          <input required minLength={3} maxLength={100} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label>Testimonial message
          <textarea required minLength={20} maxLength={2_000} rows={5} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
        </label>
        <label>Designation <span className="optional-label">(optional)</span>
          <input maxLength={100} value={form.designation ?? ""} placeholder="Security Analyst, Developer, Student…" onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} />
        </label>
        <label className="review-consent">
          <input type="checkbox" checked={form.publicConsent} onChange={(event) => setForm((current) => ({
            ...current,
            publicConsent: event.target.checked,
            displayNameConsent: event.target.checked && current.displayNameConsent,
          }))} />
          I give permission for this testimonial to be shown publicly if approved.
        </label>
        <label className="review-consent">
          <input type="checkbox" checked={form.displayNameConsent} disabled={!form.publicConsent} onChange={(event) => setForm((current) => ({ ...current, displayNameConsent: event.target.checked }))} />
          If published, show my name. Otherwise, display it as “PrivSentinel user.”
        </label>
        <div className="review-actions">
          <button className="auth-submit" type="submit" disabled={saving || deleting || form.rating === 0}>
            {saving ? "Submitting…" : review ? "Save and resubmit" : "Submit for review"}
          </button>
          {review && <button className="review-delete" type="button" disabled={saving || deleting} onClick={() => void removeReview()}>
            {deleting ? "Deleting…" : "Delete review"}
          </button>}
        </div>
      </form>
    </section>
  );
}

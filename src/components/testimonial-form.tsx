"use client";

import { FormEvent, useState } from "react";
import { DottedLoader } from "@/components/dotted-loader";
import { authClient } from "@/lib/auth-client";
import {
  useDeleteTestimonialMutation,
  useMyTestimonialQuery,
  useSaveTestimonialMutation,
  useUpdateTestimonialMutation,
} from "@/hooks/use-testimonials";

type ReviewForm = { rating: number; title: string; message: string; designation: string };

const emptyReview: ReviewForm = {
  rating: 0,
  title: "",
  message: "",
  designation: "",
};

export function TestimonialForm() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id;
  const reviewQuery = useMyTestimonialQuery(userId);
  const saveReview = useSaveTestimonialMutation(userId ?? "");
  const updateReview = useUpdateTestimonialMutation(userId ?? "");
  const deleteReview = useDeleteTestimonialMutation(userId ?? "");
  const review = reviewQuery.data?.testimonial ?? null;
  const [formDraft, setFormDraft] = useState<ReviewForm | null>(null);
  const form = formDraft ?? (review ? {
    rating: review.rating,
    title: review.title,
    message: review.quote,
    designation: review.designation ?? "",
  } : emptyReview);
  const loading = sessionPending || reviewQuery.isPending;
  const saving = saveReview.isPending || updateReview.isPending;
  const deleting = deleteReview.isPending;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const result = review
        ? await updateReview.mutateAsync({ id: review.id, input: form })
        : await saveReview.mutateAsync(form);
      if (!result.testimonial) throw new Error("Your review was saved but could not be refreshed.");
      setFormDraft({
        rating: result.testimonial.rating,
        title: result.testimonial.title,
        message: result.testimonial.quote,
        designation: result.testimonial.designation ?? "",
      });
      setNotice("Your review was submitted for moderation. It will not be public until approved.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your review could not be saved.");
    }
  }

  async function removeReview() {
    if (!review || !window.confirm("Delete your testimonial? This cannot be undone.")) return;
    setError("");
    setNotice("");
    try {
      await deleteReview.mutateAsync(review.id);
      setFormDraft(emptyReview);
      setNotice("Your review has been deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Your review could not be deleted.");
    }
  }

  if (reviewQuery.error && !reviewQuery.data) {
    return <section className="account-panel testimonial-form-panel"><p className="account-message error" role="alert">{reviewQuery.error.message || "Your review could not be loaded."}</p></section>;
  }

  if (loading) {
    return <section className="account-panel testimonial-form-panel" aria-busy="true"><DottedLoader label="Loading your review…" /></section>;
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
                onClick={() => setFormDraft((current) => ({ ...(current ?? form), rating }))}
              >★</button>
            ))}
          </div>
        </fieldset>
        <label>Testimonial title
          <input required minLength={3} maxLength={100} value={form.title} onChange={(event) => setFormDraft((current) => ({ ...(current ?? form), title: event.target.value }))} />
        </label>
        <label>Testimonial message
          <textarea required minLength={20} maxLength={2_000} rows={5} value={form.message} onChange={(event) => setFormDraft((current) => ({ ...(current ?? form), message: event.target.value }))} />
        </label>
        <label>Designation <span className="optional-label">(optional)</span>
          <input maxLength={100} value={form.designation} placeholder="Security Analyst, Developer, Student…" onChange={(event) => setFormDraft((current) => ({ ...(current ?? form), designation: event.target.value }))} />
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

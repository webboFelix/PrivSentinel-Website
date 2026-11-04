import { describe, expect, it } from "vitest";
import { testimonialSchema } from "./route";

const validReview = {
  rating: 5,
  title: "A useful security tool",
  message: "PrivSentinel has made our endpoint review process clearer.",
  designation: "Security Analyst",
  publicConsent: true,
  displayNameConsent: false,
};

describe("testimonial submission validation", () => {
  it("accepts valid review content and trims optional fields", () => {
    const result = testimonialSchema.safeParse({ ...validReview, designation: " Developer " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.designation).toBe("Developer");
  });

  it("rejects ratings outside the five-star range and non-integer ratings", () => {
    expect(testimonialSchema.safeParse({ ...validReview, rating: 0 }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...validReview, rating: 6 }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...validReview, rating: 4.5 }).success).toBe(false);
  });

  it("requires public consent before allowing display-name consent", () => {
    const result = testimonialSchema.safeParse({
      ...validReview,
      publicConsent: false,
      displayNameConsent: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects client-supplied identity, role, and moderation state", () => {
    expect(testimonialSchema.safeParse({ ...validReview, userId: "another-user" }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...validReview, status: "approved" }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...validReview, role: "admin" }).success).toBe(false);
  });
});

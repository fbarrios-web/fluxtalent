import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { interviewConfirmCandidateHtml, interviewConfirmRecruiterHtml } from "./email-templates";

const brand = { consultancyName: "Freddo", brandColor: "#141353" };

describe("interview confirmation instructions", () => {
  test("candidate confirmation marks configured instructions as IMPORTANT", () => {
    const html = interviewConfirmCandidateHtml({
      ...brand,
      firstName: "Florencia",
      vacancyTitle: "Atención al cliente",
      whenLabel: "10 de octubre, 10:00",
      meetLink: "https://meet.example.com/interview",
      instructions: "Presentate 10 minutos antes con DNI.",
    });
    assert.match(html, /IMPORTANTE/);
    assert.match(html, /Presentate 10 minutos antes con DNI\./);
  });

  test("recruiter confirmation includes the same important instructions", () => {
    const html = interviewConfirmRecruiterHtml({
      ...brand,
      candidateName: "Florencia Barrios",
      candidateEmail: "candidate@example.com",
      vacancyTitle: "Atención al cliente",
      whenLabel: "10 de octubre, 10:00",
      meetLink: "",
      location: "Local Freddo",
      instructions: "Presentate 10 minutos antes con DNI.",
    });
    assert.match(html, /IMPORTANTE/);
    assert.match(html, /Presentate 10 minutos antes con DNI\./);
  });
});
"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  User,
  Briefcase,
  Award,
  Code2,
  ArrowRight,
  RefreshCw,
  Zap,
} from "lucide-react";
import { ExtractedResume } from "@/src/schemas/candidate/resume";
import { DUMMY_RESUME_ID, MOCK_STRUCTURED_RESUME } from "@/src/lib/documents/default-interview-plan";
import LatticeLoader from "@/src/components/ui/loaders/LatticeLoader";
import { Button } from "@/src/components/ui/actions/Button";
import { Card } from "@/src/components/ui/containers/Card";

interface ResumeUploadFlowProps {
  onSuccess?: (interviewId: string) => void;
}

const POPULAR_ROLES = [
  "Full Stack Engineer",
  "Senior Backend Engineer",
  "Frontend Specialist",
  "Systems & Cloud Architect",
  "Data / ML Engineer",
];

export function ResumeUploadFlow({ onSuccess }: ResumeUploadFlowProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"custom" | "demo">("custom");
  const [step, setStep] = useState<"upload" | "parsing" | "confirm">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const [resumeId, setResumeId] = useState<string>(DUMMY_RESUME_ID);
  const [jobRole, setJobRole] = useState("Software Developer");
  const [candidateProfile, setCandidateProfile] =
    useState<ExtractedResume>(MOCK_STRUCTURED_RESUME);

  const [skillInput, setSkillInput] = useState("");
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (selectedFile: File) => {
    const ext = selectedFile.name.toLowerCase().split(".").pop();
    const validExts = ["pdf", "docx", "doc", "txt", "md", "text", "markdown", "rtf", "odt", "html", "htm"];
    if (!ext || !validExts.includes(ext)) {
      setError("Please upload a supported document (.pdf, .docx, .doc, .rtf, .odt, .txt, or .md).");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File size exceeds 5MB limit.");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setStep("parsing");

    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(selectedFile);
      });

      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64Data,
          fileName: selectedFile.name,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to parse resume with AI");
      }

      setResumeId(data.id || DUMMY_RESUME_ID);
      if (data.structuredData) {
        setCandidateProfile(data.structuredData);
      }
      if (data.warning) {
        setError(data.warning);
      } else {
        setError(null);
      }
      setStep("confirm");
    } catch (err: unknown) {
      console.error("Resume parse error:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "An error occurred while analyzing your resume. You can manually edit your profile below.";
      setError(msg);
      setResumeId((prev) => (prev && prev !== DUMMY_RESUME_ID ? prev : DUMMY_RESUME_ID));
      setStep("confirm");
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleUseDemoProfile = () => {
    setActiveTab("demo");
    setFile(null);
    setResumeId(DUMMY_RESUME_ID);
    setCandidateProfile(MOCK_STRUCTURED_RESUME);
    setError(null);
    setStep("confirm");
  };

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (candidateProfile.topSkills.includes(trimmed)) {
      setSkillInput("");
      return;
    }
    if (candidateProfile.topSkills.length >= 5) {
      setError("Maximum 5 top skills allowed.");
      return;
    }

    setCandidateProfile({
      ...candidateProfile,
      topSkills: [...candidateProfile.topSkills, trimmed],
    });
    setSkillInput("");
    setError(null);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (candidateProfile.topSkills.length <= 1) {
      setError("At least 1 core skill is required.");
      return;
    }
    setCandidateProfile({
      ...candidateProfile,
      topSkills: candidateProfile.topSkills.filter((s) => s !== skillToRemove),
    });
    setError(null);
  };

  const handleAddProject = () => {
    if (!newProjectTitle.trim() || !newProjectDesc.trim()) return;
    if (candidateProfile.coreProjects.length >= 3) {
      setError("Maximum 3 core projects allowed.");
      return;
    }

    setCandidateProfile({
      ...candidateProfile,
      coreProjects: [
        ...candidateProfile.coreProjects,
        { title: newProjectTitle.trim(), description: newProjectDesc.trim() },
      ],
    });
    setNewProjectTitle("");
    setNewProjectDesc("");
    setShowAddProject(false);
    setError(null);
  };

  const handleRemoveProject = (index: number) => {
    setCandidateProfile({
      ...candidateProfile,
      coreProjects: candidateProfile.coreProjects.filter((_, i) => i !== index),
    });
  };

  const handleLaunchInterview = async () => {
    if (isLaunching) return;

    if (!candidateProfile.fullName.trim()) {
      setError("Candidate Full Name is required.");
      return;
    }
    if (!jobRole.trim()) {
      setError("Target Job Role is required.");
      return;
    }

    setIsLaunching(true);
    setError(null);

    try {
      const response = await fetch("/api/interviews/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobRole: jobRole.trim(),
          resumeId,
          customCandidateProfile: candidateProfile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.detail || "Failed to initialize interview session.");
      }

      if (onSuccess) {
        onSuccess(data.id);
      } else {
        router.push(`/interview/${data.id}/lobby`);
      }
    } catch (err: unknown) {
      console.error("Initialize interview error:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Network error while launching interview session.";
      setError(msg);
      setIsLaunching(false);
    }
  };

  return (
    <Card className="h-auto lg:h-full min-h-[380px] lg:min-h-0 flex flex-col justify-between overflow-hidden p-4 sm:p-5 bg-white border border-[#e2e8f0] shadow-xs">
      {/* Tab Switcher & Step Indicator (Matching Image #1) */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0]">
          <button
            type="button"
            onClick={() => {
              setActiveTab("custom");
              setStep("upload");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "custom"
                ? "bg-[#3730a3] text-white font-semibold shadow-xs"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Resume</span>
          </button>
          <button
            type="button"
            onClick={handleUseDemoProfile}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "demo"
                ? "bg-[#3730a3] text-white font-semibold shadow-xs"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Instant Demo Profile</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              step === "upload"
                ? "bg-[#e0e7ff] text-[#4338ca] border border-[#c7d2fe]"
                : "bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5]" />
            1. Ingestion
          </span>
          <span className="text-[#cbd5e1]">→</span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
              step === "confirm"
                ? "bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]"
                : "bg-[#f1f5f9] text-[#94a3b8] border border-[#e2e8f0]"
            }`}
          >
            2. Confirmation
          </span>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="shrink-0 mt-2 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">{error}</div>
          <button
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Middle Content Area (Internal Scroll) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 my-2">
        {/* STEP 1: UPLOAD ZONE (Exact match to Image #1) */}
        {step === "upload" && (
          <div className="h-full flex flex-col justify-center py-2">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 sm:p-6 text-center transition-all cursor-pointer ${
                isDragOver
                  ? "border-[#4f46e5] bg-[#eef2ff]/50 scale-[1.01]"
                  : "border-[#cbd5e1] bg-[#f8fafc]/70 hover:border-[#6366f1] hover:bg-[#f1f5f9]/80"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.docx,.doc,.txt,.md,.text,.markdown,.rtf,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/rtf,application/vnd.oasis.opendocument.text"
                className="hidden"
              />

              {/* DOCX and PDF icons from Image #1 */}
              <div className="mb-3 flex items-center justify-center gap-2">
                <div className="flex items-center justify-center rounded-lg bg-[#38bdf8]/15 border border-[#38bdf8]/30 px-2 py-1 text-[11px] font-bold text-[#0284c7] font-mono shadow-xs">
                  DOCX
                </div>
                <div className="flex items-center justify-center rounded-lg bg-[#f43f5e]/15 border border-[#f43f5e]/30 px-2 py-1 text-[11px] font-bold text-[#e11d48] font-mono shadow-xs">
                  PDF
                </div>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-[#0f172a]">
                Drop your resume here, or{" "}
                <span className="text-[#4f46e5] underline decoration-[#4f46e5]/40 underline-offset-4">
                  browse files
                </span>
              </h3>
              <p className="mt-1 text-xs text-[#64748b] max-w-sm leading-relaxed">
                Accepts PDF, DOCX, DOC, RTF, TXT, MD, and ODT (max 5MB). AI extracts your profile, projects, and target competencies.
              </p>

              {/* Bottom Quick Action Pills from Image #1 */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1e293b] text-white hover:bg-[#0f172a] transition-all shadow-xs cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload Resume</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseDemoProfile();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0] hover:bg-[#e2e8f0] transition-all shadow-xs cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Instant Demo Profile</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PARSING STATE */}
        {step === "parsing" && (
          <div className="h-full flex flex-col items-center justify-center py-10 text-center space-y-4 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc]">
            <LatticeLoader
              label="Analyzing resume structure"
              pattern="orbit"
              grid={3}
              cellSize={8}
              color="#4f46e5"
              status="working"
            />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#0f172a]">Extracting Profile Signals</h3>
              <p className="text-xs text-[#64748b] max-w-xs mx-auto">
                Synthesizing skills and project evidence from{" "}
                <span className="text-[#4f46e5] font-semibold">{file?.name || "Resume document"}</span>...
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: EDITABLE PROFILE CONFIRMATION */}
        {step === "confirm" && (
          <div className="space-y-3.5 pr-0.5">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#4f46e5] uppercase tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Extracted Candidate Profile</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setError(null);
                }}
                className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Re-upload</span>
              </button>
            </div>

            {/* Basic Info Fields */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-[#334155]">
                  <User className="h-3 w-3 text-[#4f46e5]" />
                  Candidate Full Name
                </label>
                <input
                  type="text"
                  value={candidateProfile.fullName}
                  onChange={(e) =>
                    setCandidateProfile({
                      ...candidateProfile,
                      fullName: e.target.value,
                    })
                  }
                  placeholder="Candidate Name"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs text-[#0f172a] focus:border-[#4f46e5] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-[#334155]">
                  <Briefcase className="h-3 w-3 text-[#0284c7]" />
                  Target Job Role
                </label>
                <input
                  type="text"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs text-[#0f172a] focus:border-[#4f46e5] focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Role Selector Chips */}
            <div className="space-y-1">
              <span className="text-[10px] text-[#64748b] font-medium">Quick Role Suggestions:</span>
              <div className="flex flex-wrap gap-1">
                {POPULAR_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setJobRole(role)}
                    className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                      jobRole === role
                        ? "bg-[#e0e7ff] text-[#3730a3] border-[#c7d2fe] font-semibold"
                        : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:text-[#0f172a] hover:bg-[#f1f5f9]"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Years of Experience */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[11px] font-medium text-[#334155]">
                <Award className="h-3 w-3 text-[#16a34a]" />
                Years of Experience
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={candidateProfile.yearsOfExperience}
                  onChange={(e) =>
                    setCandidateProfile({
                      ...candidateProfile,
                      yearsOfExperience: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-16 rounded-xl border border-[#e2e8f0] bg-white px-2.5 py-1 text-xs font-semibold text-[#0f172a] focus:border-[#4f46e5] focus:outline-none"
                />
                <span className="text-xs text-[#64748b]">
                  {candidateProfile.yearsOfExperience === 0
                    ? "Fresher / Junior"
                    : `${candidateProfile.yearsOfExperience} Years Experience`}
                </span>
              </div>
            </div>

            {/* Top Skills Tag Cloud */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-[11px] font-medium text-[#334155]">
                  <Code2 className="h-3 w-3 text-amber-500" />
                  Core Competencies (1–5)
                </label>
                <span className="text-[10px] text-[#94a3b8]">
                  {candidateProfile.topSkills.length}/5 Skills
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {candidateProfile.topSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded-full border border-[#c7d2fe] bg-[#e0e7ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#3730a3]"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-[#4338ca] hover:text-[#1e1b4b] transition-colors cursor-pointer"
                      title="Remove skill"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              {candidateProfile.topSkills.length < 5 && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    placeholder="Add skill (e.g. Distributed Systems)..."
                    className="flex-1 rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:border-[#4f46e5] focus:outline-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleAddSkill}
                    className="h-7 text-xs px-2.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Core Projects List */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-[11px] font-medium text-[#334155]">
                  <FileText className="h-3 w-3 text-[#0284c7]" />
                  Key Projects & Systems
                </label>
                {candidateProfile.coreProjects.length < 3 && !showAddProject && (
                  <button
                    type="button"
                    onClick={() => setShowAddProject(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-[#4f46e5] hover:text-[#3730a3] cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Project</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {candidateProfile.coreProjects.map((proj, idx) => (
                  <div
                    key={idx}
                    className="group relative rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-[#0f172a]">
                      <span>{proj.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveProject(idx)}
                        className="text-[#94a3b8] hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Delete project"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-[#64748b] leading-relaxed line-clamp-2">{proj.description}</p>
                  </div>
                ))}

                {showAddProject && (
                  <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff]/40 p-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Project Title"
                      value={newProjectTitle}
                      onChange={(e) => setNewProjectTitle(e.target.value)}
                      className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs text-[#0f172a] focus:border-[#4f46e5] focus:outline-none"
                    />
                    <textarea
                      placeholder="Brief architectural overview..."
                      rows={2}
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs text-[#0f172a] focus:border-[#4f46e5] focus:outline-none resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddProject(false)}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleAddProject}
                        className="h-7 text-xs bg-[#1e293b] text-white"
                      >
                        Save Project
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pinned Action Bar at Bottom of Card */}
      {step === "confirm" && (
        <div className="shrink-0 pt-2 border-t border-[#f1f5f9]">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleLaunchInterview}
            isLoading={isLaunching}
            className="w-full font-semibold shadow-xs text-xs sm:text-sm gap-2 h-10 bg-[#1e293b] hover:bg-[#0f172a] text-white"
          >
            <span>Confirm & Proceed to Lobby</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}

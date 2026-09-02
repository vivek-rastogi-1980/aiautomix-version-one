"use client";

import { useActionState } from "react";
import { NotebookPen } from "lucide-react";

import { Card } from "@/components/ui/card";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { generateBusinessPlanAction } from "@/features/business-plans/actions";
import { PLAN_SECTION_COUNT } from "@/features/business-plans/sections";
import { idleState } from "@/lib/forms/action-state";
import {
  BUSINESS_MODELS,
  BUSINESS_STAGES,
  MODEL_LABELS,
  STAGE_LABELS,
} from "@/lib/validations/business-idea";
import type { BusinessPlanInput } from "@/lib/validations/business-plan";
import type { BusinessIdea, Project } from "@/types/database";

interface PlanFormProps {
  projects: Project[];
  ideas: BusinessIdea[];
  /**
   * Starting values, when the brief was prefilled from a validation report.
   *
   * The form stays UNCONTROLLED — these become `defaultValue`, not `value`.
   * That is what keeps the prefill a starting point rather than a cage: the
   * customer can edit every field, and React never reasserts the original.
   */
  initial?: Partial<BusinessPlanInput>;
  /**
   * The report the prefill came from, posted back as a hidden field so the
   * generated plan can link to its source. Re-verified server-side before it is
   * persisted — see `generateBusinessPlanAction`.
   */
  validationReportId?: string;
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children}
      </div>
    </Card>
  );
}

/** The brief that drives the Business Plan Generator. */
export function PlanForm({
  projects,
  ideas,
  initial,
  validationReportId,
}: PlanFormProps) {
  const [state, formAction] = useActionState(
    generateBusinessPlanAction,
    idleState,
  );
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {/* Carried through the post so the plan can record where it came from.
          Hidden because it is not the customer's to choose — and harmless if
          tampered with, since the action re-reads it under their own session. */}
      {validationReportId ? (
        <input
          type="hidden"
          name="validationReportId"
          value={validationReportId}
        />
      ) : null}
      {state.status === "error" && !errors ? (
        <FormAlert variant="error">{state.message}</FormAlert>
      ) : null}

      <FormSection
        title="The business"
        description="What you're building and who it's for."
      >
        <div className="sm:col-span-2">
          <Label htmlFor="businessName">Business name *</Label>
          <Input
            id="businessName"
            name="businessName"
            defaultValue={initial?.businessName ?? ""}
            placeholder="Acme Invoicing"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.businessName)}
          />
          <FieldError>{errors?.businessName}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="ideaDescription">Business idea *</Label>
          <Textarea
            id="ideaDescription"
            name="ideaDescription"
            defaultValue={initial?.ideaDescription ?? ""}
            rows={5}
            placeholder="Describe what the business does, the problem it solves and how it works."
            className="mt-1.5"
            aria-invalid={Boolean(errors?.ideaDescription)}
            aria-describedby={
              errors?.ideaDescription
                ? "ideaDescription-error"
                : "ideaDescription-hint"
            }
          />
          {errors?.ideaDescription ? (
            <FieldError id="ideaDescription-error">
              {errors.ideaDescription}
            </FieldError>
          ) : (
            <p
              id="ideaDescription-hint"
              className="mt-1.5 text-xs text-muted-strong"
            >
              At least 40 characters. The more specific, the better the plan.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="industry">Industry *</Label>
          <Input
            id="industry"
            name="industry"
            defaultValue={initial?.industry ?? ""}
            placeholder="Fintech"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.industry)}
          />
          <FieldError>{errors?.industry}</FieldError>
        </div>

        <div>
          <Label htmlFor="country">Country / market *</Label>
          <Input
            id="country"
            name="country"
            defaultValue={initial?.country ?? ""}
            placeholder="India"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.country)}
          />
          <FieldError>{errors?.country}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="targetAudience">Target audience *</Label>
          <Textarea
            id="targetAudience"
            name="targetAudience"
            defaultValue={initial?.targetAudience ?? ""}
            rows={2}
            placeholder="Owners of service businesses with 5-50 staff who invoice manually."
            className="mt-1.5"
            aria-invalid={Boolean(errors?.targetAudience)}
          />
          <FieldError>{errors?.targetAudience}</FieldError>
        </div>
      </FormSection>

      <FormSection
        title="Commercials"
        description="How it makes money, what it costs, and where it stands today."
      >
        <div>
          <Label htmlFor="businessModel">Business model *</Label>
          <Select
            id="businessModel"
            name="businessModel"
            className="mt-1.5"
            defaultValue={initial?.businessModel ?? "saas"}
          >
            {BUSINESS_MODELS.map((model) => (
              <option key={model} value={model}>
                {MODEL_LABELS[model]}
              </option>
            ))}
          </Select>
          <FieldError>{errors?.businessModel}</FieldError>
        </div>

        <div>
          <Label htmlFor="currentStage">Current stage *</Label>
          <Select
            id="currentStage"
            name="currentStage"
            className="mt-1.5"
            defaultValue={initial?.currentStage ?? "idea"}
          >
            {BUSINESS_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </Select>
          <FieldError>{errors?.currentStage}</FieldError>
        </div>

        <div>
          <Label htmlFor="estimatedBudget">Estimated budget (USD) *</Label>
          <Input
            id="estimatedBudget"
            name="estimatedBudget"
            defaultValue={initial?.estimatedBudget ?? ""}
            type="number"
            min={0}
            step={1000}
            placeholder="25000"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.estimatedBudget)}
          />
          <FieldError>{errors?.estimatedBudget}</FieldError>
        </div>

        <div>
          <Label htmlFor="fundingGoal">Funding goal</Label>
          <Input
            id="fundingGoal"
            name="fundingGoal"
            defaultValue={initial?.fundingGoal ?? ""}
            placeholder="250,000 USD pre-seed"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.fundingGoal)}
          />
          <FieldError>{errors?.fundingGoal}</FieldError>
        </div>
      </FormSection>

      <FormSection
        title="Context"
        description="Optional, but it makes the operations, competition and roadmap sections far sharper."
      >
        <div>
          <Label htmlFor="timeline">Timeline</Label>
          <Input
            id="timeline"
            name="timeline"
            defaultValue={initial?.timeline ?? ""}
            placeholder="Launch in 6 months"
            className="mt-1.5"
          />
          <FieldError>{errors?.timeline}</FieldError>
        </div>

        <div>
          <Label htmlFor="teamSummary">Team</Label>
          <Input
            id="teamSummary"
            name="teamSummary"
            defaultValue={initial?.teamSummary ?? ""}
            placeholder="Two founders — engineering and sales"
            className="mt-1.5"
          />
          <FieldError>{errors?.teamSummary}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="competitors">Known competitors</Label>
          <Textarea
            id="competitors"
            name="competitors"
            defaultValue={initial?.competitors ?? ""}
            rows={2}
            placeholder="Zoho Invoice, FreshBooks"
            className="mt-1.5"
          />
          <FieldError>{errors?.competitors}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="additionalNotes">Anything else</Label>
          <Textarea
            id="additionalNotes"
            name="additionalNotes"
            defaultValue={initial?.additionalNotes ?? ""}
            rows={3}
            placeholder="Constraints, traction so far, regulatory context…"
            className="mt-1.5"
          />
          <FieldError>{errors?.additionalNotes}</FieldError>
        </div>

        {projects.length > 0 ? (
          <div>
            <Label htmlFor="projectId">Link to a project</Label>
            <Select
              id="projectId"
              name="projectId"
              className="mt-1.5"
              defaultValue={initial?.projectId ?? ""}
            >
              <option value="">None</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <FieldError>{errors?.projectId}</FieldError>
          </div>
        ) : null}

        {ideas.length > 0 ? (
          <div>
            <Label htmlFor="businessIdeaId">Link to a validated idea</Label>
            <Select
              id="businessIdeaId"
              name="businessIdeaId"
              className="mt-1.5"
              defaultValue={initial?.businessIdeaId ?? ""}
            >
              <option value="">None</option>
              {ideas.map((idea) => (
                <option key={idea.id} value={idea.id}>
                  {idea.title}
                </option>
              ))}
            </Select>
            <FieldError>{errors?.businessIdeaId}</FieldError>
          </div>
        ) : null}
      </FormSection>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton size="lg" pendingText="Writing your plan…">
          <NotebookPen className="size-4" /> Generate business plan
        </SubmitButton>
        <p className="text-sm text-muted">
          Writes all {PLAN_SECTION_COUNT} sections. This takes up to a minute.
        </p>
      </div>
    </form>
  );
}

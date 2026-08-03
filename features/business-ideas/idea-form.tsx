"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { idleState } from "@/lib/forms/action-state";
import {
  BUSINESS_MODELS,
  BUSINESS_STAGES,
  MODEL_LABELS,
  STAGE_LABELS,
} from "@/lib/validations/business-idea";
import { submitBusinessIdeaAction } from "@/features/business-ideas/actions";
import type { Project } from "@/types/database";

interface IdeaFormProps {
  projects: Project[];
}

/** Section wrapper so the long form stays scannable and consistently spaced. */
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

export function IdeaForm({ projects }: IdeaFormProps) {
  const [state, formAction] = useActionState(
    submitBusinessIdeaAction,
    idleState,
  );
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && !errors ? (
        <FormAlert variant="error">{state.message}</FormAlert>
      ) : null}

      <FormSection
        title="The basics"
        description="Tell us what you're building and who it's for."
      >
        <div className="sm:col-span-2">
          <Label htmlFor="businessName">Business name *</Label>
          <Input
            id="businessName"
            name="businessName"
            placeholder="Acme Analytics"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.businessName)}
            aria-describedby={
              errors?.businessName ? "businessName-error" : undefined
            }
          />
          <FieldError id="businessName-error">
            {errors?.businessName}
          </FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="ideaDescription">Business idea *</Label>
          <Textarea
            id="ideaDescription"
            name="ideaDescription"
            rows={6}
            placeholder="Describe the problem you're solving, your solution, and what makes it different. The more detail you give, the sharper the analysis."
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
              At least 40 characters.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="industry">Industry *</Label>
          <Input
            id="industry"
            name="industry"
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
            rows={2}
            placeholder="Small business owners with 5-50 employees who manage invoicing manually."
            className="mt-1.5"
            aria-invalid={Boolean(errors?.targetAudience)}
          />
          <FieldError>{errors?.targetAudience}</FieldError>
        </div>
      </FormSection>

      <FormSection
        title="Commercials"
        description="How the business makes money and where it stands today."
      >
        <div>
          <Label htmlFor="businessModel">Business model *</Label>
          <Select
            id="businessModel"
            name="businessModel"
            className="mt-1.5"
            defaultValue="saas"
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
            defaultValue="idea"
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
            type="number"
            min={0}
            step={100}
            placeholder="25000"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.estimatedBudget)}
          />
          <FieldError>{errors?.estimatedBudget}</FieldError>
        </div>

        <div>
          <Label htmlFor="timeline">Timeline</Label>
          <Input
            id="timeline"
            name="timeline"
            placeholder="Launch in 6 months"
            className="mt-1.5"
          />
          <FieldError>{errors?.timeline}</FieldError>
        </div>
      </FormSection>

      <FormSection
        title="Context (optional)"
        description="Anything else that helps sharpen the analysis."
      >
        {projects.length > 0 ? (
          <div className="sm:col-span-2">
            <Label htmlFor="projectId">Link to a project</Label>
            <Select
              id="projectId"
              name="projectId"
              className="mt-1.5"
              defaultValue=""
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <FieldError>{errors?.projectId}</FieldError>
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <Label htmlFor="competitors">Known competitors</Label>
          <Textarea
            id="competitors"
            name="competitors"
            rows={2}
            placeholder="Competitor A, Competitor B — and how you differ."
            className="mt-1.5"
          />
          <FieldError>{errors?.competitors}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="additionalNotes">Additional notes</Label>
          <Textarea
            id="additionalNotes"
            name="additionalNotes"
            rows={3}
            placeholder="Traction, team background, constraints, or anything else worth knowing."
            className="mt-1.5"
          />
          <FieldError>{errors?.additionalNotes}</FieldError>
        </div>
      </FormSection>

      <div className="flex flex-col items-end gap-2">
        <SubmitButton size="lg" pendingText="Analysing your idea…">
          <Sparkles className="size-4" /> Validate my idea
        </SubmitButton>
        <p className="text-xs text-muted-strong">
          Analysis usually takes 20–40 seconds.
        </p>
      </div>
    </form>
  );
}

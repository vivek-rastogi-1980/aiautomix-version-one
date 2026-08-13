"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Microscope } from "lucide-react";

import { Card } from "@/components/ui/card";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { createResearchAction } from "@/features/research/actions";
import { MAX_RESEARCH_QUESTIONS } from "@/features/research/schemas";
import type { DepthOption, ResearchPrefill } from "@/features/research/data";
import { idleState } from "@/lib/forms/action-state";
import { cn } from "@/lib/utils";
import type { BusinessIdea, BusinessPlan } from "@/types/database";

/**
 * The research brief.
 *
 * Two things this form deliberately does not do.
 *
 * It does not price the run. Every credit figure on screen comes from
 * `research_estimate_credits`, summed in SQL from the same rows the stage
 * engine charges against, and is passed in as data. A number computed in React
 * would be a second opinion about what something costs, and the user would
 * believe it.
 *
 * It does not decide what "Deep" means. The depth list, its labels, its source
 * caps and its cost all arrive from `research_depths`. Adding a depth is a
 * migration, not a change to this component.
 */

interface ResearchFormProps {
  depths: DepthOption[];
  /** Populated when the page was opened from an idea or a plan. */
  prefill: ResearchPrefill | null;
  ideas: Pick<BusinessIdea, "id" | "title">[];
  plans: Pick<BusinessPlan, "id" | "title">[];
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

export function ResearchForm({
  depths,
  prefill,
  ideas,
  plans,
}: ResearchFormProps) {
  const [state, formAction] = useActionState(createResearchAction, idleState);
  const errors = state.fieldErrors;

  const defaultDepth =
    depths.find((d) => d.id === "standard")?.id ?? depths[0]?.id ?? "standard";
  const [depth, setDepth] = useState<string>(defaultDepth);
  const selected = depths.find((d) => d.id === depth) ?? depths[0];

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && !errors ? (
        <FormAlert variant="error">{state.message}</FormAlert>
      ) : null}

      {/*
        Provenance travels as an id in a hidden field and is re-checked against
        the workspace inside `research_create_request`. Nothing about the linked
        idea or plan is copied into the research row.
      */}
      {prefill?.businessIdeaId ? (
        <input
          type="hidden"
          name="businessIdeaId"
          value={prefill.businessIdeaId}
        />
      ) : null}
      {prefill?.businessPlanId ? (
        <input
          type="hidden"
          name="businessPlanId"
          value={prefill.businessPlanId}
        />
      ) : null}

      {prefill ? (
        <Card className="flex flex-wrap items-center gap-x-2 gap-y-1 border-brand-violet/30 bg-brand-violet/5 px-5 py-4 text-sm">
          <span className="text-muted">Research based on:</span>
          <Link
            href={prefill.sourceHref}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {prefill.sourceLabel}
          </Link>
          <span className="w-full text-xs text-muted-strong">
            The fields below are filled in from it. Edit anything before you
            start.
          </span>
        </Card>
      ) : null}

      <FormSection
        title="Research goal"
        description="What are you trying to understand? This frames every stage that follows."
      >
        <div className="sm:col-span-2">
          <Label htmlFor="title">Research title *</Label>
          <Input
            id="title"
            name="title"
            defaultValue={prefill?.title ?? ""}
            placeholder="Market research — Acme Invoicing"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.title)}
          />
          <FieldError>{errors?.title}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="scope">Business description</Label>
          <Textarea
            id="scope"
            name="scope"
            rows={5}
            defaultValue={prefill?.scope ?? ""}
            placeholder="What the business does, the problem it solves and how it works."
            className="mt-1.5"
            aria-invalid={Boolean(errors?.scope)}
            aria-describedby={errors?.scope ? undefined : "scope-hint"}
          />
          {errors?.scope ? (
            <FieldError>{errors.scope}</FieldError>
          ) : (
            <p id="scope-hint" className="mt-1.5 text-xs text-muted-strong">
              The more specific this is, the more targeted the source search
              will be.
            </p>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Market"
        description="Where to look, and who the research is about."
      >
        <div>
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            name="industry"
            defaultValue={prefill?.industry ?? ""}
            placeholder="Fintech"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.industry)}
          />
          <FieldError>{errors?.industry}</FieldError>
        </div>

        <div>
          <Label htmlFor="geography">Geography</Label>
          <Input
            id="geography"
            name="geography"
            defaultValue={prefill?.geography ?? ""}
            placeholder="India"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.geography)}
          />
          <FieldError>{errors?.geography}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="targetCustomer">Target customer</Label>
          <Textarea
            id="targetCustomer"
            name="targetCustomer"
            rows={2}
            defaultValue={prefill?.targetCustomer ?? ""}
            placeholder="Owners of service businesses with 5-50 staff who invoice manually."
            className="mt-1.5"
            aria-invalid={Boolean(errors?.targetCustomer)}
          />
          <FieldError>{errors?.targetCustomer}</FieldError>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="businessModel">Business model</Label>
          <Input
            id="businessModel"
            name="businessModel"
            defaultValue={prefill?.businessModel ?? ""}
            placeholder="SaaS — monthly subscription"
            className="mt-1.5"
            aria-invalid={Boolean(errors?.businessModel)}
          />
          <FieldError>{errors?.businessModel}</FieldError>
        </div>
      </FormSection>

      {!prefill && (ideas.length > 0 || plans.length > 0) ? (
        <FormSection
          title="Business context"
          description="Optionally link this research to work already in the workspace. The link is stored as a reference — nothing is copied."
        >
          {ideas.length > 0 ? (
            <div>
              <Label htmlFor="businessIdeaId">Business idea</Label>
              <Select
                id="businessIdeaId"
                name="businessIdeaId"
                className="mt-1.5"
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

          {plans.length > 0 ? (
            <div>
              <Label htmlFor="businessPlanId">Business plan</Label>
              <Select
                id="businessPlanId"
                name="businessPlanId"
                className="mt-1.5"
              >
                <option value="">None</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </Select>
              <FieldError>{errors?.businessPlanId}</FieldError>
            </div>
          ) : null}
        </FormSection>
      ) : null}

      <Card className="p-6 sm:p-7">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Research questions
        </h2>
        <p className="mt-1 text-sm text-muted">
          One per line. Leave this empty and the planning stage will propose its
          own.
        </p>
        <div className="mt-6">
          <Label htmlFor="questions">
            Questions{" "}
            <span className="font-normal text-muted-strong">
              (up to {MAX_RESEARCH_QUESTIONS})
            </span>
          </Label>
          <Textarea
            id="questions"
            name="questions"
            rows={5}
            className="mt-1.5"
            placeholder={
              "How large is the market?\nWho are the main competitors?\nWhat do customers pay today?"
            }
            aria-invalid={Boolean(errors?.questions)}
          />
          <FieldError>{errors?.questions}</FieldError>
        </div>
      </Card>

      <Card className="p-6 sm:p-7">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Depth
        </h2>
        <p className="mt-1 text-sm text-muted">
          Deeper research searches more broadly, takes longer and consumes more
          credits.
        </p>

        {/*
          A radiogroup rather than a select: the three options differ in cost
          and each needs its numbers visible at the moment of choosing, not one
          at a time behind a dropdown.
        */}
        <fieldset className="mt-6">
          <legend className="sr-only">Research depth</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {depths.map((option) => {
              const active = option.id === depth;
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-2xl border p-4 transition-colors",
                    "focus-within:ring-2 focus-within:ring-brand-violet",
                    active
                      ? "border-brand-violet/60 bg-brand-violet/10"
                      : "border-line bg-fill-2 hover:border-white/20",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="depth"
                      value={option.id}
                      checked={active}
                      onChange={() => setDepth(option.id)}
                      className="size-4 accent-brand-violet"
                    />
                    <span className="font-display text-sm font-bold tracking-tight text-foreground">
                      {option.label}
                    </span>
                  </span>
                  <span className="mt-2 text-xs text-muted">
                    {option.description}
                  </span>
                  <span className="mt-3 text-xs font-semibold text-foreground">
                    {option.estimatedCredits} credits
                  </span>
                  <span className="text-xs text-muted-strong">
                    up to {option.maxSources} sources
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <FieldError>{errors?.depth}</FieldError>

        {selected ? (
          <p
            role="status"
            className="mt-5 rounded-xl border border-line bg-fill-2 px-4 py-3 text-sm text-muted"
          >
            <strong className="font-semibold text-foreground">
              Estimated usage:
            </strong>{" "}
            about {selected.estimatedCredits} credits for all seven stages at{" "}
            {selected.label} depth. Credits are charged per stage as it runs, and
            a failed stage is refunded — so you only pay for what completes.
          </p>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton size="lg" pendingText="Creating…">
          <Microscope className="size-4" /> Create research project
        </SubmitButton>
        <p className="text-sm text-muted">
          Nothing runs yet. You start the first stage from the research page.
        </p>
      </div>
    </form>
  );
}

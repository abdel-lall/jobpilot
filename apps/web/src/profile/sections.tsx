import { zodResolver } from "@hookform/resolvers/zod";
import {
  createSkillBodySchema,
  updateSkillBodySchema,
  type Certification,
  type CreateCertificationBody,
  type CreateEducationBody,
  type CreateProjectBody,
  type CreateSkillBody,
  type CreateWorkExperienceBody,
  type Education,
  type Project,
  type Skill,
  type UpdateCertificationBody,
  type UpdateEducationBody,
  type UpdateProjectBody,
  type UpdateSkillBody,
  type UpdateWorkExperienceBody,
  type WorkExperience,
} from "@jobpilot/shared";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { useForm, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ResumesSection } from "@/profile/resumes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  certificationCreateResolver,
  certificationEditResolver,
  certificationFormValues,
  educationCreateResolver,
  educationEditResolver,
  educationFormValues,
  emptyCertification,
  emptyEducation,
  emptyExperience,
  emptyProject,
  experienceCreateResolver,
  experienceEditResolver,
  experienceFormValues,
  projectCreateResolver,
  projectEditResolver,
  projectFormValues,
  type CertificationFormValues,
  type EducationFormValues,
  type ExperienceFormValues,
  type ProjectFormValues,
} from "@/profile/forms";
import {
  createCertification,
  createEducation,
  createExperience,
  createProject,
  createSkill,
  deleteCertification,
  deleteEducation,
  deleteExperience,
  deleteProject,
  deleteSkill,
  listCertifications,
  listEducation,
  listExperience,
  listProjects,
  listSkills,
  profilePaths,
  profileQueryKey,
  requestErrorMessage,
  updateCertification,
  updateEducation,
  updateExperience,
  updateProject,
  updateSkill,
} from "@/profile/requests";

const ongoingHelp = "Leave blank if ongoing.";
const expiresHelp = "Leave blank if it does not expire.";

type SectionProps = {
  userId: string;
  accessToken: string | null;
};

type Runner = (action: () => Promise<void>) => Promise<void>;

function requireToken(accessToken: string | null): string {
  if (accessToken === null || accessToken.length === 0) {
    throw new Error("Request failed");
  }
  return accessToken;
}

function useRequestError(): { requestError: string | null; run: Runner } {
  const [requestError, setRequestError] = useState<string | null>(null);
  const run = useCallback<Runner>(async (action) => {
    setRequestError(null);
    try {
      await action();
    } catch (error) {
      setRequestError(requestErrorMessage(error));
    }
  }, []);
  return { requestError, run };
}

function useProfileQuery<T>(
  path: string,
  userId: string,
  accessToken: string | null,
  queryFn: (token: string) => Promise<T[]>,
) {
  return useQuery({
    queryKey: profileQueryKey(path, userId),
    enabled: accessToken !== null && accessToken.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => {
      if (accessToken === null || accessToken.length === 0) {
        throw new Error("Request failed");
      }
      return queryFn(accessToken);
    },
  });
}

function useRefetch(path: string, userId: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    return queryClient.refetchQueries({ queryKey: profileQueryKey(path, userId) });
  }, [path, queryClient, userId]);
}

function fieldControl<T extends FieldValues, TTransformedValues>(
  control: Control<T, unknown, TTransformedValues>,
): Control<T> {
  return control as unknown as Control<T>;
}

function TextField<T extends FieldValues>({
  control,
  name,
  label,
  type = "text",
  description,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  type?: "text" | "date" | "url";
  description?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              {...field}
              value={typeof field.value === "string" ? field.value : ""}
            />
          </FormControl>
          {description !== undefined ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function LinesField<T extends FieldValues>({
  control,
  name,
  label,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea {...field} value={typeof field.value === "string" ? field.value : ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function RootMessage({ message }: { message: string | undefined }) {
  if (message === undefined || message.length === 0) {
    return null;
  }
  return <p data-slot="form-message">{message}</p>;
}

function TextValue({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label} </span>
      <span>{value}</span>
    </p>
  );
}

function LinesValue({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      {values.map((value, index) => (
        <p key={`${index}-${value}`}>
          <span>{value}</span>
        </p>
      ))}
    </div>
  );
}

function ProfileSection({
  testId,
  title,
  loadingText,
  emptyText,
  query,
  requestError,
  children,
  createForm,
}: {
  testId: string;
  title: string;
  loadingText: string;
  emptyText: string;
  query: UseQueryResult<unknown[]>;
  requestError: string | null;
  children: ReactNode;
  createForm: ReactNode;
}) {
  const data = query.data;
  const showLoading = data === undefined && query.isFetching;
  const showEmpty = data !== undefined && data.length === 0;
  const listError = query.isError ? requestErrorMessage(query.error) : null;

  return (
    <section data-testid={testId}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{title}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {showLoading ? <p data-testid={`${testId}-loading`}>{loadingText}</p> : null}
          {listError !== null ? <p role="alert">{listError}</p> : null}
          {showEmpty ? <p data-testid={`${testId}-empty`}>{emptyText}</p> : null}
          {data !== undefined && data.length > 0 ? <ul className="grid gap-4">{children}</ul> : null}
          {requestError !== null ? <p role="alert">{requestError}</p> : null}
          {createForm}
        </CardContent>
      </Card>
    </section>
  );
}

function SubmitRow({
  label,
  submitting,
  onCancel,
}: {
  label: string;
  submitting: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={submitting}>
        {label}
      </Button>
      {onCancel !== undefined ? (
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

function formProps(label: string, onSubmit: (event: FormEvent<HTMLFormElement>) => void) {
  return {
    "aria-label": label,
    noValidate: true,
    className: "grid gap-4",
    onSubmit,
  };
}

function CreateSkillForm({
  accessToken,
  run,
  onCreated,
}: {
  accessToken: string | null;
  run: Runner;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<CreateSkillBody>({
    resolver: zodResolver(createSkillBodySchema),
    defaultValues: { name: "" },
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Add skill",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await createSkill(requireToken(accessToken), values);
              form.reset();
              await onCreated();
            });
          }),
        )}
      >
        <TextField control={form.control} name="name" label="Name" />
        <SubmitRow label="Add skill" submitting={form.formState.isSubmitting} />
      </form>
    </Form>
  );
}

function EditSkillForm({
  accessToken,
  skill,
  run,
  onCancel,
  onSaved,
}: {
  accessToken: string | null;
  skill: Skill;
  run: Runner;
  onCancel: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<UpdateSkillBody>({
    resolver: zodResolver(updateSkillBodySchema),
    defaultValues: { name: skill.name },
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Edit skill",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await updateSkill(requireToken(accessToken), skill.id, values);
              onCancel();
              await onSaved();
            });
          }),
        )}
      >
        <TextField control={form.control} name="name" label="Name" />
        <SubmitRow label="Save skill" submitting={form.formState.isSubmitting} onCancel={onCancel} />
      </form>
    </Form>
  );
}

function SkillsSection({ userId, accessToken }: SectionProps) {
  const query = useProfileQuery(profilePaths.skills, userId, accessToken, listSkills);
  const refetch = useRefetch(profilePaths.skills, userId);
  const { requestError, run } = useRequestError();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ProfileSection
      testId="profile-skills"
      title="Skills"
      loadingText="Loading skills…"
      emptyText="No skills yet."
      query={query}
      requestError={requestError}
      createForm={<CreateSkillForm accessToken={accessToken} run={run} onCreated={refetch} />}
    >
      {query.data?.map((skill) => (
        <li key={skill.id} className="grid gap-3">
          <TextValue label="Name" value={skill.name} />
          {editingId === skill.id ? (
            <EditSkillForm
              accessToken={accessToken}
              skill={skill}
              run={run}
              onCancel={() => setEditingId(null)}
              onSaved={refetch}
            />
          ) : (
            <Button type="button" onClick={() => setEditingId(skill.id)}>
              Edit skill
            </Button>
          )}
          <Button
            type="button"
            onClick={() => {
              void run(async () => {
                await deleteSkill(requireToken(accessToken), skill.id);
                if (editingId === skill.id) {
                  setEditingId(null);
                }
                await refetch();
              });
            }}
          >
            Delete skill
          </Button>
        </li>
      ))}
    </ProfileSection>
  );
}

function EducationFields({ control }: { control: Control<EducationFormValues> }) {
  return (
    <>
      <TextField control={control} name="institution" label="Institution" />
      <TextField control={control} name="degree" label="Degree" />
      <TextField control={control} name="fieldOfStudy" label="Field of study" />
      <TextField control={control} name="startDate" label="Start date" type="date" />
      <TextField
        control={control}
        name="endDate"
        label="End date"
        type="date"
        description={ongoingHelp}
      />
    </>
  );
}

function CreateEducationForm({
  accessToken,
  run,
  onCreated,
}: {
  accessToken: string | null;
  run: Runner;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<EducationFormValues, unknown, CreateEducationBody>({
    resolver: educationCreateResolver,
    defaultValues: emptyEducation,
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Add education",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await createEducation(requireToken(accessToken), values);
              form.reset();
              await onCreated();
            });
          }),
        )}
      >
        <EducationFields control={fieldControl(form.control)} />
        <RootMessage message={form.formState.errors.root?.message} />
        <SubmitRow label="Add education" submitting={form.formState.isSubmitting} />
      </form>
    </Form>
  );
}

function EditEducationForm({
  accessToken,
  record,
  run,
  onCancel,
  onSaved,
}: {
  accessToken: string | null;
  record: Education;
  run: Runner;
  onCancel: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<EducationFormValues, unknown, UpdateEducationBody>({
    resolver: educationEditResolver,
    defaultValues: educationFormValues(record),
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Edit education",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await updateEducation(requireToken(accessToken), record.id, values);
              onCancel();
              await onSaved();
            });
          }),
        )}
      >
        <EducationFields control={fieldControl(form.control)} />
        <RootMessage message={form.formState.errors.root?.message} />
        <SubmitRow label="Save education" submitting={form.formState.isSubmitting} onCancel={onCancel} />
      </form>
    </Form>
  );
}

function EducationSection({ userId, accessToken }: SectionProps) {
  const query = useProfileQuery(profilePaths.education, userId, accessToken, listEducation);
  const refetch = useRefetch(profilePaths.education, userId);
  const { requestError, run } = useRequestError();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ProfileSection
      testId="profile-education"
      title="Education"
      loadingText="Loading education…"
      emptyText="No education yet."
      query={query}
      requestError={requestError}
      createForm={<CreateEducationForm accessToken={accessToken} run={run} onCreated={refetch} />}
    >
      {query.data?.map((record) => (
        <li key={record.id} className="grid gap-3">
          <TextValue label="Institution" value={record.institution} />
          <TextValue label="Degree" value={record.degree} />
          <TextValue label="Field of study" value={record.fieldOfStudy} />
          <TextValue label="Start date" value={record.startDate} />
          <TextValue label="End date" value={record.endDate ?? "Present"} />
          {editingId === record.id ? (
            <EditEducationForm
              accessToken={accessToken}
              record={record}
              run={run}
              onCancel={() => setEditingId(null)}
              onSaved={refetch}
            />
          ) : (
            <Button type="button" onClick={() => setEditingId(record.id)}>
              Edit education
            </Button>
          )}
          <Button
            type="button"
            onClick={() => {
              void run(async () => {
                await deleteEducation(requireToken(accessToken), record.id);
                if (editingId === record.id) {
                  setEditingId(null);
                }
                await refetch();
              });
            }}
          >
            Delete education
          </Button>
        </li>
      ))}
    </ProfileSection>
  );
}

function ExperienceFields({ control }: { control: Control<ExperienceFormValues> }) {
  return (
    <>
      <TextField control={control} name="employer" label="Employer" />
      <TextField control={control} name="jobTitle" label="Job title" />
      <TextField control={control} name="startDate" label="Start date" type="date" />
      <TextField
        control={control}
        name="endDate"
        label="End date"
        type="date"
        description={ongoingHelp}
      />
      <LinesField control={control} name="accomplishments" label="Accomplishments" />
      <LinesField control={control} name="technologies" label="Technologies" />
    </>
  );
}

function CreateExperienceForm({
  accessToken,
  run,
  onCreated,
}: {
  accessToken: string | null;
  run: Runner;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<ExperienceFormValues, unknown, CreateWorkExperienceBody>({
    resolver: experienceCreateResolver,
    defaultValues: emptyExperience,
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Add experience",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await createExperience(requireToken(accessToken), values);
              form.reset();
              await onCreated();
            });
          }),
        )}
      >
        <ExperienceFields control={fieldControl(form.control)} />
        <RootMessage message={form.formState.errors.root?.message} />
        <SubmitRow label="Add experience" submitting={form.formState.isSubmitting} />
      </form>
    </Form>
  );
}

function EditExperienceForm({
  accessToken,
  record,
  run,
  onCancel,
  onSaved,
}: {
  accessToken: string | null;
  record: WorkExperience;
  run: Runner;
  onCancel: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<ExperienceFormValues, unknown, UpdateWorkExperienceBody>({
    resolver: experienceEditResolver,
    defaultValues: experienceFormValues(record),
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Edit experience",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await updateExperience(requireToken(accessToken), record.id, values);
              onCancel();
              await onSaved();
            });
          }),
        )}
      >
        <ExperienceFields control={fieldControl(form.control)} />
        <RootMessage message={form.formState.errors.root?.message} />
        <SubmitRow label="Save experience" submitting={form.formState.isSubmitting} onCancel={onCancel} />
      </form>
    </Form>
  );
}

function ExperienceSection({ userId, accessToken }: SectionProps) {
  const query = useProfileQuery(profilePaths.experience, userId, accessToken, listExperience);
  const refetch = useRefetch(profilePaths.experience, userId);
  const { requestError, run } = useRequestError();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ProfileSection
      testId="profile-experience"
      title="Work experience"
      loadingText="Loading work experience…"
      emptyText="No work experience yet."
      query={query}
      requestError={requestError}
      createForm={<CreateExperienceForm accessToken={accessToken} run={run} onCreated={refetch} />}
    >
      {query.data?.map((record) => (
        <li key={record.id} className="grid gap-3">
          <TextValue label="Employer" value={record.employer} />
          <TextValue label="Job title" value={record.jobTitle} />
          <TextValue label="Start date" value={record.startDate} />
          <TextValue label="End date" value={record.endDate ?? "Present"} />
          <LinesValue label="Accomplishments" values={record.accomplishments} />
          <LinesValue label="Technologies" values={record.technologies} />
          {editingId === record.id ? (
            <EditExperienceForm
              accessToken={accessToken}
              record={record}
              run={run}
              onCancel={() => setEditingId(null)}
              onSaved={refetch}
            />
          ) : (
            <Button type="button" onClick={() => setEditingId(record.id)}>
              Edit experience
            </Button>
          )}
          <Button
            type="button"
            onClick={() => {
              void run(async () => {
                await deleteExperience(requireToken(accessToken), record.id);
                if (editingId === record.id) {
                  setEditingId(null);
                }
                await refetch();
              });
            }}
          >
            Delete experience
          </Button>
        </li>
      ))}
    </ProfileSection>
  );
}

function ProjectFields({ control }: { control: Control<ProjectFormValues> }) {
  return (
    <>
      <TextField control={control} name="name" label="Name" />
      <TextField control={control} name="description" label="Description" />
      <TextField control={control} name="url" label="URL" type="url" />
      <TextField control={control} name="startDate" label="Start date" type="date" />
      <TextField
        control={control}
        name="endDate"
        label="End date"
        type="date"
        description={ongoingHelp}
      />
      <LinesField control={control} name="accomplishments" label="Accomplishments" />
      <LinesField control={control} name="technologies" label="Technologies" />
    </>
  );
}

function CreateProjectForm({
  accessToken,
  run,
  onCreated,
}: {
  accessToken: string | null;
  run: Runner;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<ProjectFormValues, unknown, CreateProjectBody>({
    resolver: projectCreateResolver,
    defaultValues: emptyProject,
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Add project",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await createProject(requireToken(accessToken), values);
              form.reset();
              await onCreated();
            });
          }),
        )}
      >
        <ProjectFields control={fieldControl(form.control)} />
        <RootMessage message={form.formState.errors.root?.message} />
        <SubmitRow label="Add project" submitting={form.formState.isSubmitting} />
      </form>
    </Form>
  );
}

function EditProjectForm({
  accessToken,
  record,
  run,
  onCancel,
  onSaved,
}: {
  accessToken: string | null;
  record: Project;
  run: Runner;
  onCancel: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<ProjectFormValues, unknown, UpdateProjectBody>({
    resolver: projectEditResolver,
    defaultValues: projectFormValues(record),
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Edit project",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await updateProject(requireToken(accessToken), record.id, values);
              onCancel();
              await onSaved();
            });
          }),
        )}
      >
        <ProjectFields control={fieldControl(form.control)} />
        <RootMessage message={form.formState.errors.root?.message} />
        <SubmitRow label="Save project" submitting={form.formState.isSubmitting} onCancel={onCancel} />
      </form>
    </Form>
  );
}

function ProjectsSection({ userId, accessToken }: SectionProps) {
  const query = useProfileQuery(profilePaths.projects, userId, accessToken, listProjects);
  const refetch = useRefetch(profilePaths.projects, userId);
  const { requestError, run } = useRequestError();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ProfileSection
      testId="profile-projects"
      title="Projects"
      loadingText="Loading projects…"
      emptyText="No projects yet."
      query={query}
      requestError={requestError}
      createForm={<CreateProjectForm accessToken={accessToken} run={run} onCreated={refetch} />}
    >
      {query.data?.map((record) => (
        <li key={record.id} className="grid gap-3">
          <TextValue label="Name" value={record.name} />
          <TextValue label="Description" value={record.description} />
          {record.url !== null ? <TextValue label="URL" value={record.url} /> : null}
          {record.startDate !== null ? <TextValue label="Start date" value={record.startDate} /> : null}
          <TextValue label="End date" value={record.endDate ?? "Present"} />
          <LinesValue label="Accomplishments" values={record.accomplishments} />
          <LinesValue label="Technologies" values={record.technologies} />
          {editingId === record.id ? (
            <EditProjectForm
              accessToken={accessToken}
              record={record}
              run={run}
              onCancel={() => setEditingId(null)}
              onSaved={refetch}
            />
          ) : (
            <Button type="button" onClick={() => setEditingId(record.id)}>
              Edit project
            </Button>
          )}
          <Button
            type="button"
            onClick={() => {
              void run(async () => {
                await deleteProject(requireToken(accessToken), record.id);
                if (editingId === record.id) {
                  setEditingId(null);
                }
                await refetch();
              });
            }}
          >
            Delete project
          </Button>
        </li>
      ))}
    </ProfileSection>
  );
}

function CertificationFields({ control }: { control: Control<CertificationFormValues> }) {
  return (
    <>
      <TextField control={control} name="name" label="Name" />
      <TextField control={control} name="issuer" label="Issuer" />
      <TextField control={control} name="issuedOn" label="Issued on" type="date" />
      <TextField
        control={control}
        name="expiresOn"
        label="Expires on"
        type="date"
        description={expiresHelp}
      />
    </>
  );
}

function CreateCertificationForm({
  accessToken,
  run,
  onCreated,
}: {
  accessToken: string | null;
  run: Runner;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<CertificationFormValues, unknown, CreateCertificationBody>({
    resolver: certificationCreateResolver,
    defaultValues: emptyCertification,
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Add certification",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await createCertification(requireToken(accessToken), values);
              form.reset();
              await onCreated();
            });
          }),
        )}
      >
        <CertificationFields control={fieldControl(form.control)} />
        <RootMessage message={form.formState.errors.root?.message} />
        <SubmitRow label="Add certification" submitting={form.formState.isSubmitting} />
      </form>
    </Form>
  );
}

function EditCertificationForm({
  accessToken,
  record,
  run,
  onCancel,
  onSaved,
}: {
  accessToken: string | null;
  record: Certification;
  run: Runner;
  onCancel: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<CertificationFormValues, unknown, UpdateCertificationBody>({
    resolver: certificationEditResolver,
    defaultValues: certificationFormValues(record),
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Edit certification",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await updateCertification(requireToken(accessToken), record.id, values);
              onCancel();
              await onSaved();
            });
          }),
        )}
      >
        <CertificationFields control={fieldControl(form.control)} />
        <RootMessage message={form.formState.errors.root?.message} />
        <SubmitRow
          label="Save certification"
          submitting={form.formState.isSubmitting}
          onCancel={onCancel}
        />
      </form>
    </Form>
  );
}

function CertificationsSection({ userId, accessToken }: SectionProps) {
  const query = useProfileQuery(profilePaths.certifications, userId, accessToken, listCertifications);
  const refetch = useRefetch(profilePaths.certifications, userId);
  const { requestError, run } = useRequestError();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ProfileSection
      testId="profile-certifications"
      title="Certifications"
      loadingText="Loading certifications…"
      emptyText="No certifications yet."
      query={query}
      requestError={requestError}
      createForm={
        <CreateCertificationForm accessToken={accessToken} run={run} onCreated={refetch} />
      }
    >
      {query.data?.map((record) => (
        <li key={record.id} className="grid gap-3">
          <TextValue label="Name" value={record.name} />
          <TextValue label="Issuer" value={record.issuer} />
          <TextValue label="Issued on" value={record.issuedOn} />
          <TextValue label="Expires on" value={record.expiresOn ?? "Present"} />
          {editingId === record.id ? (
            <EditCertificationForm
              accessToken={accessToken}
              record={record}
              run={run}
              onCancel={() => setEditingId(null)}
              onSaved={refetch}
            />
          ) : (
            <Button type="button" onClick={() => setEditingId(record.id)}>
              Edit certification
            </Button>
          )}
          <Button
            type="button"
            onClick={() => {
              void run(async () => {
                await deleteCertification(requireToken(accessToken), record.id);
                if (editingId === record.id) {
                  setEditingId(null);
                }
                await refetch();
              });
            }}
          >
            Delete certification
          </Button>
        </li>
      ))}
    </ProfileSection>
  );
}

export function ProfileSections({ userId, accessToken }: SectionProps) {
  return (
    <>
      <SkillsSection userId={userId} accessToken={accessToken} />
      <EducationSection userId={userId} accessToken={accessToken} />
      <ExperienceSection userId={userId} accessToken={accessToken} />
      <ProjectsSection userId={userId} accessToken={accessToken} />
      <CertificationsSection userId={userId} accessToken={accessToken} />
      <ResumesSection userId={userId} accessToken={accessToken} />
    </>
  );
}

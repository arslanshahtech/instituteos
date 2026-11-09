import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { useToast } from '../components/ui/ToastProvider.js';
import { getCampuses } from '../organizations/organizations-api.js';
import { listAcademicYears } from '../academics/academics-api.js';
import type { AcademicYear } from '../academics/academics-api.js';
import {
  executePromotion,
  getPromotionPreview,
  getPromotionSourceCount,
  listPromotionHistory,
} from './promotion-api.js';
import type { PromotionMapping, PromotionPreview } from './promotion-api.js';
import './student-promotion.css';

type Step = 1 | 2 | 3 | 4;
const controlStyle = {
  padding: '9px 11px',
  minHeight: 42,
  boxSizing: 'border-box',
  border: '1px solid var(--border, #d7dce2)',
  borderRadius: 8,
  minWidth: 0,
  width: '100%',
  background: 'var(--surface, white)',
  color: 'inherit',
} as const;
const cardStyle = {
  border: '1px solid var(--border, #e1e5ea)',
  borderRadius: 12,
  padding: 16,
  background: 'var(--surface, white)',
} as const;

function errorText(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Request could not be completed. Please try again.';
}
function formatMoney(value: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value);
}
function formatPromotionFee(value: number) {
  return `PKR ${new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export function StudentPromotionPage() {
  const { organizationId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createdSessionId = searchParams.get('createdSessionId') ?? '';
  const toast = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [campusId, setCampusId] = useState('');
  const [sourceAcademicYearId, setSourceAcademicYearId] = useState('');
  const [targetAcademicYearId, setTargetAcademicYearId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [onlyUnpaidStudents, setOnlyUnpaidStudents] = useState(false);
  const [studentFeeOverrides, setStudentFeeOverrides] = useState<
    Record<string, { mode: 'class' | 'current' | 'custom'; amount?: string }>
  >({});
  const [expandedClassIds, setExpandedClassIds] = useState<string[] | null>(
    null,
  );
  const [mappings, setMappings] = useState<Record<string, PromotionMapping>>(
    {},
  );
  const [excludedClassIds, setExcludedClassIds] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showStartConfirmation, setShowStartConfirmation] = useState(false);

  const campusesQuery = useQuery({
    queryKey: ['promotion-campuses', organizationId],
    queryFn: () => getCampuses(organizationId),
    enabled: Boolean(organizationId),
  });
  const yearsQuery = useQuery({
    queryKey: ['academic-years', organizationId],
    queryFn: () => listAcademicYears(organizationId),
    enabled: Boolean(organizationId),
  });
  const campuses = campusesQuery.data?.campuses ?? [];
  const years: AcademicYear[] = yearsQuery.data?.items ?? [];
  useEffect(() => {
    if (!campusId && campuses.length > 0) setCampusId(campuses[0]!.id);
    const current = years.find((year) => year.status === 'active');
    if (current && !sourceAcademicYearId) setSourceAcademicYearId(current.id);
    if (current && !targetAcademicYearId) {
      const nextSession = years
        .filter((year) => year.startDate > current.startDate)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      if (nextSession) setTargetAcademicYearId(nextSession.id);
    }
  }, [campuses, campusId, years, sourceAcademicYearId, targetAcademicYearId]);
  useEffect(() => {
    if (
      createdSessionId &&
      years.some((year) => year.id === createdSessionId) &&
      createdSessionId !== sourceAcademicYearId
    ) {
      setTargetAcademicYearId(createdSessionId);
    }
  }, [createdSessionId, years, sourceAcademicYearId]);
  const previewQuery = useQuery({
    queryKey: [
      'promotion-preview',
      organizationId,
      sourceAcademicYearId,
      targetAcademicYearId,
      campusId,
    ],
    queryFn: () =>
      getPromotionPreview(organizationId, {
        sourceAcademicYearId,
        targetAcademicYearId,
        campusId,
      }),
    enabled: Boolean(
      organizationId &&
      sourceAcademicYearId &&
      targetAcademicYearId &&
      campusId &&
      sourceAcademicYearId !== targetAcademicYearId,
    ),
    retry: false,
  });
  const preview: PromotionPreview | undefined = previewQuery.data;
  const sourceCountQuery = useQuery({
    queryKey: [
      'promotion-source-count',
      organizationId,
      sourceAcademicYearId,
      campusId,
    ],
    queryFn: () =>
      getPromotionSourceCount(organizationId, {
        sourceAcademicYearId,
        campusId,
      }),
    enabled: Boolean(organizationId && sourceAcademicYearId && campusId),
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: ['promotion-history', organizationId],
    queryFn: () => listPromotionHistory(organizationId),
    enabled: Boolean(organizationId && showHistory),
  });

  const sourceClasses = useMemo(() => {
    const students = preview?.students ?? [];
    return [...(preview?.classes ?? [])]
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          a.name.localeCompare(b.name),
      )
      .map((item) => {
        const classStudents = students.filter(
          (student) => student.sourceClassId === item.id,
        );
        return {
          id: item.id,
          name: item.name,
          count: classStudents.length,
          sections: (preview?.sections ?? []).filter(
            (section) => section.classId === item.id,
          ),
        };
      });
  }, [preview?.classes, preview?.sections, preview?.students]);

  useEffect(() => {
    if (step === 3 && sourceClasses.length && expandedClassIds === null) {
      setExpandedClassIds(sourceClasses.map((item) => item.id));
    }
  }, [step, sourceClasses, expandedClassIds]);

  const mappingKey = (classId: string, sectionId: string) =>
    `${classId}:${sectionId}`;
  const preferredFeeForClass = (classId?: string) => {
    if (!classId) return undefined;
    const choices = (preview?.feeStructures ?? []).filter(
      (fee) => fee.classId === classId,
    );
    return choices.find((fee) => /monthly/i.test(fee.name)) ?? choices[0];
  };
  const defaultMapping = (
    sourceClassId: string,
    sourceSectionId: string,
  ): PromotionMapping => {
    const classIndex = sourceClasses.findIndex(
      (item) => item.id === sourceClassId,
    );
    const nextClass = sourceClasses[classIndex + 1];
    const sourceSection = preview?.sections.find(
      (item) => item.id === sourceSectionId,
    );
    const targetSection = nextClass
      ? ((preview?.sections ?? []).find(
          (item) =>
            item.classId === nextClass.id &&
            item.name.toLowerCase() === sourceSection?.name.toLowerCase(),
        ) ??
        (preview?.sections ?? []).find((item) => item.classId === nextClass.id))
      : undefined;
    const fee = preferredFeeForClass(nextClass?.id);
    return {
      sourceClassId,
      sourceSectionId,
      outcome: nextClass ? 'promoted' : 'graduated',
      targetClassId: nextClass?.id,
      targetSectionId: targetSection?.id,
      feeStructureId: fee?.id,
    };
  };
  const getMapping = (sourceClassId: string, sourceSectionId: string) =>
    mappings[mappingKey(sourceClassId, sourceSectionId)] ??
    defaultMapping(sourceClassId, sourceSectionId);
  const activeStudents = (preview?.students ?? []).filter(
    (student) => !excludedClassIds.includes(student.sourceClassId),
  );
  const unpaidStudents = activeStudents.filter(
    (student) => student.unpaidInvoiceCount > 0,
  );
  const visibleStudents = onlyUnpaidStudents ? unpaidStudents : activeStudents;
  const selectedFeeId = (studentId: string, mapping: PromotionMapping) =>
    studentFeeOverrides[studentId]?.mode === 'class'
      ? (mapping.feeStructureId ?? '')
      : (mapping.feeStructureId ?? '');
  const selectedReviewStudents = activeStudents.filter((student) =>
    selectedIds.includes(student.id),
  );
  const reviewCounts = selectedReviewStudents.reduce(
    (counts, student) => {
      const outcome = getMapping(
        student.sourceClassId,
        student.sourceSectionId,
      ).outcome;
      if (outcome === 'graduated') counts.graduating += 1;
      else if (outcome === 'repeated') counts.repeating += 1;
      else counts.promoted += 1;
      return counts;
    },
    { promoted: 0, repeating: 0, graduating: 0 },
  );
  const leftAsTheyAreCount = Math.max(
    0,
    (preview?.students.length ?? 0) - selectedReviewStudents.length,
  );

  const executeMutation = useMutation({
    mutationFn: () =>
      executePromotion(organizationId, {
        sourceAcademicYearId,
        targetAcademicYearId,
        campusId,
        effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
        studentIds: selectedIds,
        studentFeeOverrides: selectedIds.flatMap((studentId) => {
          const override = studentFeeOverrides[studentId];
          return override && override.mode !== 'class'
            ? [
                {
                  studentId,
                  mode: override.mode,
                  amount:
                    override.mode === 'current'
                      ? Number(
                          activeStudents.find(
                            (student) => student.id === studentId,
                          )?.currentFee ?? 0,
                        )
                      : Number(override.amount),
                },
              ]
            : [];
        }),
        mappings: sourceClasses
          .filter((item) => !excludedClassIds.includes(item.id))
          .flatMap((item) =>
            item.sections.map((section) => getMapping(item.id, section.id)),
          ),
      }),
    onSuccess: async ({ promotion }) => {
      toast.showToast(
        `Promotion completed: ${promotion.promotedCount} students placed in the target session, ${promotion.graduatedCount} graduated.`,
        'success',
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['promotion-history', organizationId],
        }),
        queryClient.invalidateQueries({ queryKey: ['student-placements'] }),
        queryClient.invalidateQueries({ queryKey: ['students'] }),
      ]);
      setStep(1);
      setShowStartConfirmation(false);
      setSelectedIds([]);
      setStudentFeeOverrides({});
      setExpandedClassIds(null);
      setOnlyUnpaidStudents(false);
      setMappings({});
      await previewQuery.refetch();
    },
    onError: (error) => toast.showToast(errorText(error), 'info'),
  });

  function updateMapping(
    sourceClassId: string,
    sourceSectionId: string,
    changes: Partial<PromotionMapping>,
  ) {
    const key = mappingKey(sourceClassId, sourceSectionId);
    setMappings((current) => ({
      ...current,
      [key]: {
        ...getMapping(sourceClassId, sourceSectionId),
        ...changes,
        sourceClassId,
        sourceSectionId,
      },
    }));
  }
  function toggleStudent(studentId: string) {
    setSelectedIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  }
  function next() {
    if (
      step === 1 &&
      (!campusId ||
        !sourceAcademicYearId ||
        !targetAcademicYearId ||
        sourceAcademicYearId === targetAcademicYearId)
    ) {
      toast.showToast(
        'Select campus, source session and a different target session.',
        'info',
      );
      return;
    }
    if (step === 2) {
      const missing = sourceClasses
        .filter((item) => !excludedClassIds.includes(item.id))
        .some((item) => {
          if (item.count > 0 && item.sections.length === 0) return true;
          const occupiedSectionIds = new Set(
            (preview?.students ?? [])
              .filter((student) => student.sourceClassId === item.id)
              .map((student) => student.sourceSectionId),
          );
          return item.sections.some((section) => {
            if (!occupiedSectionIds.has(section.id)) return false;
            const map = getMapping(item.id, section.id);
            return (
              map.outcome !== 'graduated' &&
              (!map.targetClassId || !map.targetSectionId)
            );
          });
        });
      if (missing) {
        toast.showToast(
          'Every included class with students needs sections and a destination section.',
          'info',
        );
        return;
      }
    }
    if (step === 3 && selectedIds.length === 0) {
      toast.showToast('Select at least one student to continue.', 'info');
      return;
    }
    if (step === 3) {
      const missingClassFee = selectedIds.some((studentId) => {
        const student = activeStudents.find((item) => item.id === studentId);
        if (!student) return false;
        const mapping = getMapping(
          student.sourceClassId,
          student.sourceSectionId,
        );
        const override = studentFeeOverrides[studentId];
        const feeId = mapping.feeStructureId;
        return (
          mapping.outcome !== 'graduated' &&
          (!preview?.feeStructures.some(
            (fee) => fee.id === feeId && fee.classId === mapping.targetClassId,
          ) ||
            (override?.mode === 'current' && student.currentFee <= 0) ||
            (override?.mode === 'custom' &&
              (!Number.isFinite(Number(override.amount)) ||
                Number(override.amount) <= 0)))
        );
      });
      if (missingClassFee) {
        toast.showToast(
          'Create a fee structure for each destination class before continuing.',
          'info',
        );
        return;
      }
    }
    setStep((current) => Math.min(4, current + 1) as Step);
  }

  return (
    <main className="page-stack">
      <header className="page-heading">
        <div>
          <h1>Promote students</h1>
          <p>
            Move students to their next class at the end of a session. You
            choose who moves where, and what they pay.
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setShowHistory((value) => !value)}
        >
          {showHistory ? 'Hide history' : 'Past promotions'}
        </button>
      </header>

      {showHistory && (
        <section style={cardStyle}>
          <h2>Previous promotion runs</h2>
          {historyQuery.isLoading ? (
            <p>Loading history…</p>
          ) : historyQuery.data?.items.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Effective date</th>
                    <th>Source session</th>
                    <th>Target session</th>
                    <th>Moved / repeated</th>
                    <th>Graduated</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {historyQuery.data.items.map((run) => (
                    <tr key={run.id}>
                      <td>
                        {new Date(run.effectiveDate).toLocaleDateString()}
                      </td>
                      <td>
                        {years.find(
                          (year) => year.id === run.sourceAcademicYearId,
                        )?.name ?? 'Previous session'}
                      </td>
                      <td>
                        {years.find(
                          (year) => year.id === run.targetAcademicYearId,
                        )?.name ?? 'Next session'}
                      </td>
                      <td>{run.promotedCount}</td>
                      <td>{run.graduatedCount}</td>
                      <td>{run.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No promotion history has been recorded yet.</p>
          )}
        </section>
      )}

      <nav
        aria-label="Promotion steps"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
      >
        {(
          ['Sessions', 'Class map', 'Students and fees', 'Review'] as const
        ).map((label, index) => (
          <div
            key={label}
            aria-current={step === index + 1 ? 'step' : undefined}
            style={{
              padding: '8px 12px',
              border: `1px solid ${step === index + 1 ? 'var(--color-primary, #2563eb)' : 'var(--border, #d7dce2)'}`,
              borderRadius: 7,
              color:
                step === index + 1
                  ? 'var(--text, inherit)'
                  : 'var(--muted, #718096)',
              background:
                step === index + 1 ? 'var(--surface, white)' : 'transparent',
              fontSize: 13,
            }}
          >
            {index + 1}. {label}
          </div>
        ))}
      </nav>

      {step === 1 && (
        <section style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border, #e1e5ea)',
            }}
          >
            <h2 style={{ margin: 0 }}>Sessions</h2>
            <p style={{ margin: '5px 0 0', color: 'var(--muted, #718096)' }}>
              Choose the session students are in now, and the one they move
              into.
            </p>
          </div>
          <div style={{ padding: 20 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
                alignItems: 'start',
              }}
            >
              <label style={{ display: 'grid', gap: 7, fontWeight: 500 }}>
                From session
                <select
                  style={controlStyle}
                  value={sourceAcademicYearId}
                  onChange={(event) => {
                    setSourceAcademicYearId(event.target.value);
                    setSelectedIds([]);
                  }}
                >
                  <option value="">Choose a session</option>
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 7, fontWeight: 500 }}>
                To session
                <select
                  style={controlStyle}
                  value={targetAcademicYearId}
                  onChange={(event) =>
                    setTargetAcademicYearId(event.target.value)
                  }
                >
                  <option value="">Choose a session</option>
                  {years
                    .filter((year) => year.id !== sourceAcademicYearId)
                    .map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                </select>
              </label>
              <div
                style={{
                  display: 'grid',
                  alignContent: 'start',
                  gap: 7,
                  minWidth: 0,
                }}
              >
                <label
                  htmlFor="promotion-effective-date"
                  style={{ fontWeight: 500 }}
                >
                  Takes effect on
                </label>
                <input
                  id="promotion-effective-date"
                  style={{
                    ...controlStyle,
                    display: 'block',
                    minHeight: 42,
                    boxSizing: 'border-box',
                  }}
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                />
                <small
                  style={{
                    display: 'block',
                    marginTop: 0,
                    color: 'var(--muted, #718096)',
                    fontSize: 12,
                    lineHeight: 1.35,
                    fontWeight: 400,
                  }}
                >
                  Leave empty for today.
                </small>
              </div>
            </div>
            {sourceAcademicYearId &&
              targetAcademicYearId &&
              sourceAcademicYearId === targetAcademicYearId && (
                <p role="alert">From and To sessions must be different.</p>
              )}
            {(yearsQuery.isLoading || campusesQuery.isLoading) && (
              <p>Loading academic setup…</p>
            )}
            {!yearsQuery.isLoading && years.length === 0 && (
              <div role="status" style={{ marginTop: 16 }}>
                <p>
                  No academic sessions have been created yet. Create a session
                  first to continue.
                </p>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() =>
                    navigate(
                      `/admin/organizations/${organizationId}/academics?tab=curriculum-sessions&action=create&returnTo=${encodeURIComponent(`/admin/organizations/${organizationId}/admissions/promote`)}`,
                    )
                  }
                >
                  Create session
                </button>
              </div>
            )}
            {!yearsQuery.isLoading &&
              years.length > 0 &&
              sourceAcademicYearId && (
                <p
                  style={{ margin: '14px 0 0', color: 'var(--muted, #718096)' }}
                >
                  <span
                    style={{ fontWeight: 600, color: 'var(--text, #20252b)' }}
                  >
                    Moving into a session that is not listed?
                  </span>{' '}
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{
                      marginLeft: 6,
                      minHeight: 32,
                      padding: '5px 10px',
                      fontSize: 12,
                    }}
                    onClick={() =>
                      navigate(
                        `/admin/organizations/${organizationId}/academics?tab=curriculum-sessions&action=create&returnTo=${encodeURIComponent(`/admin/organizations/${organizationId}/admissions/promote`)}`,
                      )
                    }
                  >
                    Create a new session
                  </button>
                </p>
              )}
            {sourceAcademicYearId && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginTop: 18,
                  padding: '13px 16px',
                  border: '1px solid var(--border, #e1e5ea)',
                  borderRadius: 9,
                  background: 'var(--surface-subtle, #f7f9fb)',
                }}
                role="status"
                aria-live="polite"
              >
                <div
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 36,
                    height: 36,
                    flex: '0 0 36px',
                    borderRadius: 9,
                    background: 'var(--surface, white)',
                    color: 'var(--color-primary, #2563eb)',
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  #
                </div>
                <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <strong style={{ fontSize: 14, lineHeight: 1.35 }}>
                    {sourceCountQuery.isLoading ||
                    campusesQuery.isLoading ||
                    !campusId
                      ? 'Checking active students…'
                      : sourceCountQuery.error
                        ? 'Student count unavailable'
                        : `${sourceCountQuery.data?.count ?? 0} active ${sourceCountQuery.data?.count === 1 ? 'student' : 'students'}`}
                  </strong>
                  <span
                    style={{
                      color: 'var(--muted, #718096)',
                      fontSize: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {years.find((year) => year.id === sourceAcademicYearId)
                      ?.name ?? 'Selected session'}
                    {sourceCountQuery.isLoading || !campusId
                      ? ' · Loading the session student summary.'
                      : sourceCountQuery.data?.count === 0
                        ? ' · No active students found in this session.'
                        : ' · Students currently assigned to this session.'}
                  </span>
                  {sourceCountQuery.error && (
                    <span
                      style={{
                        color: 'var(--color-danger, #b42318)',
                        fontSize: 12,
                      }}
                    >
                      {errorText(sourceCountQuery.error)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {step === 2 && (
        <section style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '18px 20px',
              borderBottom: '1px solid var(--border, #e1e5ea)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Class map</h2>
                <p
                  style={{ margin: '5px 0 0', color: 'var(--muted, #718096)' }}
                >
                  Choose which classes move forward. Sections are matched
                  automatically; you can change any destination.
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ fontSize: 13 }}>
                  {sourceClasses.length - excludedClassIds.length} of{' '}
                  {sourceClasses.length} classes
                </strong>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setExcludedClassIds([])}
                >
                  Include all
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setExcludedClassIds(sourceClasses.map((item) => item.id));
                    setSelectedIds([]);
                  }}
                >
                  Leave all as they are
                </button>
              </div>
            </div>
          </div>
          {previewQuery.isLoading ? (
            <p style={{ padding: 20 }}>
              Loading classes, sections and fee structures…
            </p>
          ) : previewQuery.error ? (
            <p role="alert" style={{ padding: 20 }}>
              {errorText(previewQuery.error)}
            </p>
          ) : sourceClasses.length ? (
            <div>
              {sourceClasses.map((source) => {
                const excluded = excludedClassIds.includes(source.id);
                const firstSection = source.sections[0];
                const firstMapping = firstSection
                  ? getMapping(source.id, firstSection.id)
                  : undefined;
                return (
                  <article
                    key={source.id}
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border, #e1e5ea)',
                      opacity: excluded ? 0.62 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                        gap: 18,
                        alignItems: 'start',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!excluded}
                          onChange={(event) => {
                            setExcludedClassIds((current) =>
                              event.target.checked
                                ? current.filter((id) => id !== source.id)
                                : [...current, source.id],
                            );
                            if (!event.target.checked) {
                              const classStudentIds = new Set(
                                (preview?.students ?? [])
                                  .filter(
                                    (student) =>
                                      student.sourceClassId === source.id,
                                  )
                                  .map((student) => student.id),
                              );
                              setSelectedIds((current) =>
                                current.filter(
                                  (id) => !classStudentIds.has(id),
                                ),
                              );
                            }
                          }}
                          style={{
                            marginTop: 4,
                            width: 17,
                            height: 17,
                            accentColor: 'var(--color-primary, #0f766e)',
                          }}
                        />
                        <span style={{ display: 'grid', gap: 3 }}>
                          <strong>{source.name}</strong>
                          <small style={{ color: 'var(--muted, #718096)' }}>
                            {source.count}{' '}
                            {source.count === 1 ? 'student' : 'students'}
                          </small>
                          {excluded && (
                            <small style={{ color: 'var(--muted, #718096)' }}>
                              Will remain in the current class
                            </small>
                          )}
                        </span>
                      </label>
                      <div style={{ display: 'grid', gap: 10 }}>
                        <label
                          style={{
                            display: 'grid',
                            gap: 5,
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {firstMapping?.outcome !== 'graduated' &&
                          sourceClasses[
                            sourceClasses.findIndex(
                              (item) => item.id === source.id,
                            ) + 1
                          ]
                            ? 'Promote to'
                            : ''}
                          <select
                            style={controlStyle}
                            value={firstMapping?.outcome ?? 'graduated'}
                            disabled={excluded || !firstSection}
                            onChange={(event) => {
                              const outcome = event.target
                                .value as PromotionMapping['outcome'];
                              source.sections.forEach((section) => {
                                const sourceSection = section;
                                if (outcome === 'graduated')
                                  updateMapping(source.id, sourceSection.id, {
                                    outcome,
                                    targetClassId: undefined,
                                    targetSectionId: undefined,
                                    feeStructureId: undefined,
                                  });
                                else if (outcome === 'repeated')
                                  updateMapping(source.id, sourceSection.id, {
                                    outcome,
                                    targetClassId: source.id,
                                    targetSectionId: sourceSection.id,
                                    feeStructureId: preferredFeeForClass(
                                      source.id,
                                    )?.id,
                                  });
                                else {
                                  const nextClass =
                                    sourceClasses[
                                      sourceClasses.findIndex(
                                        (item) => item.id === source.id,
                                      ) + 1
                                    ];
                                  const match = nextClass
                                    ? ((preview?.sections ?? []).find(
                                        (item) =>
                                          item.classId === nextClass.id &&
                                          item.name.toLowerCase() ===
                                            sourceSection.name.toLowerCase(),
                                      ) ??
                                      (preview?.sections ?? []).find(
                                        (item) => item.classId === nextClass.id,
                                      ))
                                    : undefined;
                                  updateMapping(source.id, sourceSection.id, {
                                    outcome,
                                    targetClassId: nextClass?.id,
                                    targetSectionId: match?.id,
                                    feeStructureId: preferredFeeForClass(
                                      nextClass?.id,
                                    )?.id,
                                  });
                                }
                              });
                            }}
                          >
                            {sourceClasses[
                              sourceClasses.findIndex(
                                (item) => item.id === source.id,
                              ) + 1
                            ] && (
                              <option value="promoted">
                                Promote to{' '}
                                {
                                  sourceClasses[
                                    sourceClasses.findIndex(
                                      (item) => item.id === source.id,
                                    ) + 1
                                  ]?.name
                                }
                              </option>
                            )}
                            <option value="repeated">Repeat this class</option>
                            <option value="graduated">Graduate</option>
                          </select>
                        </label>
                        {!excluded &&
                          firstMapping?.outcome !== 'graduated' &&
                          source.sections.length > 0 && (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {source.sections.map((section) => {
                                const mapping = getMapping(
                                  source.id,
                                  section.id,
                                );
                                const destinationSections = (
                                  preview?.sections ?? []
                                ).filter(
                                  (item) =>
                                    item.classId === mapping.targetClassId,
                                );
                                const destinationFee = preferredFeeForClass(
                                  mapping.targetClassId,
                                );
                                return (
                                  <div
                                    key={section.id}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns:
                                        'minmax(70px, 0.55fr) minmax(130px, 1fr) minmax(130px, 1fr)',
                                      gap: 8,
                                      alignItems: 'center',
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 13,
                                        color: 'var(--muted, #718096)',
                                      }}
                                    >
                                      {section.name}
                                    </span>
                                    <select
                                      aria-label={
                                        source.name +
                                        ' ' +
                                        section.name +
                                        ' destination class'
                                      }
                                      style={controlStyle}
                                      value={mapping.targetClassId ?? ''}
                                      disabled={mapping.outcome === 'repeated'}
                                      onChange={(event) => {
                                        const targetClassId =
                                          event.target.value;
                                        const matchingSection =
                                          (preview?.sections ?? []).find(
                                            (item) =>
                                              item.classId === targetClassId &&
                                              item.name.toLowerCase() ===
                                                section.name.toLowerCase(),
                                          ) ??
                                          (preview?.sections ?? []).find(
                                            (item) =>
                                              item.classId === targetClassId,
                                          );
                                        updateMapping(source.id, section.id, {
                                          targetClassId,
                                          targetSectionId: matchingSection?.id,
                                          feeStructureId:
                                            preferredFeeForClass(targetClassId)
                                              ?.id,
                                        });
                                      }}
                                    >
                                      <option value="">Select class</option>
                                      {(preview?.classes ?? [])
                                        .filter(
                                          (item) =>
                                            mapping.outcome === 'repeated' ||
                                            item.id !== source.id,
                                        )
                                        .map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.name}
                                          </option>
                                        ))}
                                    </select>
                                    <select
                                      aria-label={
                                        source.name +
                                        ' ' +
                                        section.name +
                                        ' destination section'
                                      }
                                      style={controlStyle}
                                      value={mapping.targetSectionId ?? ''}
                                      onChange={(event) =>
                                        updateMapping(source.id, section.id, {
                                          targetSectionId: event.target.value,
                                        })
                                      }
                                      disabled={
                                        !mapping.targetClassId ||
                                        destinationSections.length === 0
                                      }
                                    >
                                      <option value="">Select section</option>
                                      {destinationSections.map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.name}
                                        </option>
                                      ))}
                                    </select>
                                    <small
                                      style={{
                                        gridColumn: '2 / -1',
                                        color: 'var(--muted, #718096)',
                                        fontSize: 12,
                                      }}
                                    >
                                      Destination class fee:{' '}
                                      {destinationFee
                                        ? `${destinationFee.name} · ${formatMoney(destinationFee.total)}`
                                        : `No fee structure for ${years.find((year) => year.id === targetAcademicYearId)?.name ?? 'the target session'}`}
                                    </small>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        {!excluded && !source.sections.length && (
                          <small
                            role="alert"
                            style={{ color: 'var(--color-danger, #b42318)' }}
                          >
                            No sections are configured for this class.
                          </small>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p style={{ padding: 20 }}>
              No classes are configured for this campus yet.
            </p>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="promotion-fees">
          <div className="promotion-fees__intro">
            <div>
              <h2>Students and fees</h2>
              <p>
                Choose students and confirm their fees for the next session.
              </p>
            </div>
            <div className="promotion-fees__summary">
              <strong>{selectedIds.length}</strong>
              <span>students selected</span>
            </div>
          </div>
          <div className="promotion-fees__toolbar">
            <button
              type="button"
              className={
                onlyUnpaidStudents
                  ? 'promotion-filter is-active'
                  : 'promotion-filter'
              }
              aria-pressed={onlyUnpaidStudents}
              onClick={() => {
                setOnlyUnpaidStudents((current) => !current);
                setSelectedIds((current) =>
                  current.filter((id) =>
                    onlyUnpaidStudents
                      ? activeStudents.some((student) => student.id === id)
                      : unpaidStudents.some((student) => student.id === id),
                  ),
                );
              }}
            >
              <span className="promotion-filter__dot" />
              Only students with unpaid fees{' '}
              <strong>{unpaidStudents.length}</strong>
            </button>
            <div className="promotion-fees__selection">
              <span>
                Showing {visibleStudents.length} of {activeStudents.length}{' '}
                students
              </span>
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setSelectedIds((current) => {
                    const visibleIds = visibleStudents.map(
                      (student) => student.id,
                    );
                    const allSelected = visibleIds.every((id) =>
                      current.includes(id),
                    );
                    return allSelected
                      ? current.filter((id) => !visibleIds.includes(id))
                      : [...new Set([...current, ...visibleIds])];
                  })
                }
              >
                {visibleStudents.length > 0 &&
                visibleStudents.every((student) =>
                  selectedIds.includes(student.id),
                )
                  ? 'Clear shown'
                  : 'Select shown'}
              </button>
            </div>
          </div>
          {previewQuery.isLoading ? (
            <p className="promotion-fees__empty">
              Loading students and fee structures…
            </p>
          ) : previewQuery.isError ? (
            <p className="promotion-fees__empty" role="alert">
              {errorText(previewQuery.error)}
            </p>
          ) : visibleStudents.length === 0 ? (
            <p className="promotion-fees__empty">
              {onlyUnpaidStudents
                ? 'No students have unpaid fees in this session.'
                : 'No students are available for this promotion.'}
            </p>
          ) : (
            <div className="promotion-fees__classes">
              {sourceClasses
                .filter((source) => !excludedClassIds.includes(source.id))
                .map((source) => {
                  const allClassStudents = activeStudents.filter(
                    (student) => student.sourceClassId === source.id,
                  );
                  const classStudents = visibleStudents.filter(
                    (student) => student.sourceClassId === source.id,
                  );
                  if (!classStudents.length) return null;
                  const sectionMappings = source.sections.map((section) =>
                    getMapping(source.id, section.id),
                  );
                  const targetClassIds = [
                    ...new Set(
                      sectionMappings
                        .filter((mapping) => mapping.outcome !== 'graduated')
                        .map((mapping) => mapping.targetClassId)
                        .filter((id): id is string => Boolean(id)),
                    ),
                  ];
                  const classFeeChoices = targetClassIds.flatMap(
                    (targetClassId) =>
                      (preview?.feeStructures ?? []).filter(
                        (fee) => fee.classId === targetClassId,
                      ),
                  );
                  const missingChoiceCount = classStudents.filter((student) => {
                    const mapping = getMapping(
                      student.sourceClassId,
                      student.sourceSectionId,
                    );
                    return (
                      mapping.outcome !== 'graduated' &&
                      !classFeeChoices.some(
                        (fee) => fee.id === selectedFeeId(student.id, mapping),
                      )
                    );
                  }).length;
                  return (
                    <details
                      key={source.id}
                      className="promotion-class-card"
                      open={Boolean(expandedClassIds?.includes(source.id))}
                      onToggle={(event) => {
                        const isOpen = event.currentTarget.open;
                        setExpandedClassIds((current) => {
                          const openIds = current ?? [];
                          return isOpen
                            ? [...new Set([...openIds, source.id])]
                            : openIds.filter((id) => id !== source.id);
                        });
                      }}
                    >
                      <summary className="promotion-class-card__summary">
                        <span
                          className="promotion-class-card__chevron"
                          aria-hidden="true"
                        >
                          ›
                        </span>
                        <span className="promotion-class-card__title">
                          {source.name}
                        </span>
                        <span className="promotion-class-card__count">
                          {classStudents.length} students
                        </span>
                        {missingChoiceCount > 0 && (
                          <span className="promotion-class-card__needs">
                            {missingChoiceCount} to choose
                          </span>
                        )}
                        <span className="promotion-class-card__actions">
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={(event) => {
                              event.preventDefault();
                              const visibleClassIds = classStudents.map(
                                (student) => student.id,
                              );
                              const allVisibleSelected = visibleClassIds.every(
                                (id) => selectedIds.includes(id),
                              );
                              setSelectedIds((current) =>
                                allVisibleSelected
                                  ? current.filter(
                                      (id) => !visibleClassIds.includes(id),
                                    )
                                  : [
                                      ...new Set([
                                        ...current,
                                        ...visibleClassIds,
                                      ]),
                                    ],
                              );
                            }}
                          >
                            {classStudents.length > 0 &&
                            classStudents.every((student) =>
                              selectedIds.includes(student.id),
                            )
                              ? 'Clear class'
                              : 'Select class'}
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={(event) => {
                              event.preventDefault();
                              const nextMappings = { ...mappings };
                              source.sections.forEach((section) => {
                                const mapping = getMapping(
                                  source.id,
                                  section.id,
                                );
                                if (mapping.outcome === 'graduated') return;
                                const fee = preferredFeeForClass(
                                  mapping.targetClassId,
                                );
                                if (fee)
                                  nextMappings[
                                    mappingKey(source.id, section.id)
                                  ] = { ...mapping, feeStructureId: fee.id };
                              });
                              setMappings(nextMappings);
                              setStudentFeeOverrides((current) => {
                                const next = { ...current };
                                allClassStudents.forEach(
                                  (student) => delete next[student.id],
                                );
                                return next;
                              });
                              setExpandedClassIds((current) =>
                                (current ?? []).filter(
                                  (id) => id !== source.id,
                                ),
                              );
                            }}
                          >
                            Class fee for all
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={(event) => {
                              event.preventDefault();
                              const nextOverrides = { ...studentFeeOverrides };
                              let matched = 0;
                              allClassStudents.forEach((student) => {
                                const mapping = getMapping(
                                  student.sourceClassId,
                                  student.sourceSectionId,
                                );
                                if (
                                  mapping.outcome === 'graduated' ||
                                  student.currentFee <= 0
                                )
                                  return;
                                nextOverrides[student.id] = {
                                  mode: 'current',
                                };
                                matched += 1;
                              });
                              setStudentFeeOverrides(nextOverrides);
                              toast.showToast(
                                matched
                                  ? 'Current fee selected for ' +
                                      matched +
                                      ' students.'
                                  : 'No current fee is available for these students.',
                                matched ? 'success' : 'info',
                              );
                            }}
                          >
                            Keep current fee for all
                          </button>
                        </span>
                      </summary>
                      <div className="promotion-class-card__table-wrap">
                        <table className="promotion-fees__table">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Action</th>
                              <th>Class</th>
                              <th>Section</th>
                              <th>Current fee</th>
                              <th>Class fee</th>
                              <th>New fee</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classStudents.map((student) => {
                              const mapping = getMapping(
                                student.sourceClassId,
                                student.sourceSectionId,
                              );
                              const targetClass = preview?.classes.find(
                                (item) => item.id === mapping.targetClassId,
                              );
                              const targetSection = preview?.sections.find(
                                (item) => item.id === mapping.targetSectionId,
                              );
                              const classFee = preview?.feeStructures.find(
                                (item) =>
                                  item.id === mapping.feeStructureId &&
                                  item.classId === mapping.targetClassId,
                              );
                              const feeOverride = studentFeeOverrides[
                                student.id
                              ] ?? {
                                mode: 'class' as const,
                              };
                              const feeChoices = (
                                preview?.feeStructures ?? []
                              ).filter(
                                (fee) => fee.classId === mapping.targetClassId,
                              );
                              return (
                                <tr key={student.id}>
                                  <td>
                                    <label className="promotion-student">
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(
                                          student.id,
                                        )}
                                        onChange={() =>
                                          toggleStudent(student.id)
                                        }
                                      />
                                      <span>
                                        <strong>
                                          {student.firstName} {student.lastName}
                                        </strong>
                                        <small>
                                          {student.registrationNumber || '—'} ·{' '}
                                          {student.sourceSectionName}
                                        </small>
                                        {student.unpaidInvoiceCount > 0 && (
                                          <small className="promotion-student__unpaid">
                                            {student.unpaidInvoiceCount} unpaid{' '}
                                            {student.unpaidInvoiceCount === 1
                                              ? 'fee'
                                              : 'fees'}
                                          </small>
                                        )}
                                      </span>
                                    </label>
                                  </td>
                                  <td>
                                    <span className="promotion-action-label">
                                      {mapping.outcome === 'graduated'
                                        ? 'Graduate'
                                        : mapping.outcome === 'repeated'
                                          ? 'Repeat'
                                          : 'Promote'}
                                    </span>
                                  </td>
                                  <td>{targetClass?.name ?? '—'}</td>
                                  <td>{targetSection?.name ?? '—'}</td>
                                  <td>
                                    {student.currentFee > 0
                                      ? formatMoney(student.currentFee)
                                      : '—'}
                                    {student.outstandingBalance > 0 && (
                                      <small className="promotion-fees__subtext">
                                        {formatMoney(
                                          student.outstandingBalance,
                                        )}{' '}
                                        due
                                      </small>
                                    )}
                                  </td>
                                  <td>
                                    {classFee
                                      ? formatMoney(classFee.total)
                                      : 'Not set'}
                                  </td>
                                  <td>
                                    {mapping.outcome === 'graduated' ? (
                                      '—'
                                    ) : feeChoices.length ? (
                                      <div className="promotion-fee-choice">
                                        <select
                                          aria-label={
                                            'New fee for ' +
                                            student.firstName +
                                            ' ' +
                                            student.lastName
                                          }
                                          className="promotion-fee-select"
                                          value={feeOverride.mode}
                                          onChange={(event) =>
                                            setStudentFeeOverrides(
                                              (current) => ({
                                                ...current,
                                                [student.id]: {
                                                  ...current[student.id],
                                                  mode: event.target.value as
                                                    | 'class'
                                                    | 'current'
                                                    | 'custom',
                                                },
                                              }),
                                            )
                                          }
                                        >
                                          <option value="class">
                                            Class Fee
                                          </option>
                                          <option
                                            value="current"
                                            disabled={student.currentFee <= 0}
                                          >
                                            Current Fee
                                          </option>
                                          <option value="custom">
                                            Custom Fee
                                          </option>
                                        </select>
                                        {feeOverride.mode === 'custom' && (
                                          <div className="promotion-fee-input-wrap">
                                            <span>PKR</span>
                                            <input
                                              aria-label={
                                                'Custom fee amount for ' +
                                                student.firstName +
                                                ' ' +
                                                student.lastName
                                              }
                                              className="promotion-fee-select promotion-fee-select--amount"
                                              type="number"
                                              min="1"
                                              step="0.01"
                                              placeholder="Enter amount"
                                              value={feeOverride.amount ?? ''}
                                              onChange={(event) =>
                                                setStudentFeeOverrides(
                                                  (current) => ({
                                                    ...current,
                                                    [student.id]: {
                                                      mode: 'custom',
                                                      amount:
                                                        event.target.value,
                                                    },
                                                  }),
                                                )
                                              }
                                            />
                                          </div>
                                        )}
                                        <small className="promotion-fees__subtext">
                                          {feeOverride.mode === 'class'
                                            ? formatPromotionFee(
                                                classFee?.total ?? 0,
                                              )
                                            : feeOverride.mode === 'current'
                                              ? formatPromotionFee(
                                                  student.currentFee,
                                                )
                                              : feeOverride.amount &&
                                                  Number(feeOverride.amount) > 0
                                                ? formatPromotionFee(
                                                    Number(feeOverride.amount),
                                                  )
                                                : 'Enter custom amount'}
                                        </small>
                                      </div>
                                    ) : (
                                      <span className="promotion-fee-missing">
                                        <small className="promotion-student__unpaid">
                                          No fee configured for{' '}
                                          {targetClass?.name ??
                                            'destination class'}{' '}
                                          in{' '}
                                          {years.find(
                                            (year) =>
                                              year.id === targetAcademicYearId,
                                          )?.name ?? 'the target session'}
                                          .
                                        </small>
                                        <button
                                          type="button"
                                          className="button button-secondary"
                                          onClick={() =>
                                            navigate(
                                              `/admin/organizations/${organizationId}/finance`,
                                            )
                                          }
                                        >
                                          Set up class fee
                                        </button>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {step === 4 && (
        <section className="promotion-review">
          <div className="promotion-review__heading">
            <div>
              <h2>Review</h2>
              <p>
                From {preview?.sourceAcademicYear.name ?? 'source session'} to{' '}
                {preview?.targetAcademicYear.name ?? 'target session'}, taking
                effect on {effectiveDate || 'today'}. Nothing has changed yet.
              </p>
            </div>
          </div>

          <div
            className="promotion-review__counts"
            aria-label="Promotion summary"
          >
            {[
              { label: 'Promoted', count: reviewCounts.promoted },
              { label: 'Repeating', count: reviewCounts.repeating },
              { label: 'Demoted', count: 0 },
              { label: 'Transferred', count: 0 },
              { label: 'Graduating', count: reviewCounts.graduating },
              { label: 'Left as they are', count: leftAsTheyAreCount },
            ].map((item) => (
              <article className="promotion-review__count" key={item.label}>
                <strong>{item.count}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>

          <section className="promotion-review__panel">
            <div className="promotion-review__panel-heading">
              <h3>Options</h3>
            </div>
            <div className="promotion-review__options">
              <div>
                <strong>Unpaid fees of graduating students</strong>
                <div className="promotion-review__choice-row">
                  <label className="promotion-review__choice is-selected">
                    <input
                      type="radio"
                      name="graduation-fees"
                      checked
                      readOnly
                    />
                    Keep them owed
                  </label>
                  <label className="promotion-review__choice is-disabled">
                    <input type="radio" name="graduation-fees" disabled />
                    Delete them where nothing is paid
                  </label>
                </div>
                <small>
                  Existing invoices and payment history are preserved. Deleting
                  issued invoices is not enabled in the current finance
                  workflow.
                </small>
              </div>
              <label className="promotion-review__draft-option">
                <input type="checkbox" disabled />
                <span>
                  <strong>Delete monthly tuition drafts</strong>
                  <small>
                    Draft invoices are not currently represented as a separate
                    finance status, so no issued invoice will be deleted.
                  </small>
                </span>
              </label>
            </div>
          </section>

          <section className="promotion-review__panel">
            <div className="promotion-review__panel-heading">
              <div>
                <h3>Worth knowing</h3>
                <p>These details do not stop the promotion.</p>
              </div>
            </div>
            {selectedReviewStudents.length ? (
              <div className="promotion-review__student-list">
                {selectedReviewStudents.map((student) => {
                  const mapping = getMapping(
                    student.sourceClassId,
                    student.sourceSectionId,
                  );
                  const targetClass = preview?.classes.find(
                    (item) => item.id === mapping.targetClassId,
                  );
                  const targetSection = preview?.sections.find(
                    (item) => item.id === mapping.targetSectionId,
                  );
                  const override = studentFeeOverrides[student.id] ?? {
                    mode: 'class' as const,
                  };
                  const classFee = preview?.feeStructures.find(
                    (item) =>
                      item.id === mapping.feeStructureId &&
                      item.classId === mapping.targetClassId,
                  );
                  const newFee =
                    override.mode === 'current'
                      ? student.currentFee
                      : override.mode === 'custom'
                        ? Number(override.amount ?? 0)
                        : (classFee?.total ?? 0);
                  const outcomeLabel =
                    mapping.outcome === 'graduated'
                      ? 'Graduate'
                      : mapping.outcome === 'repeated'
                        ? 'Repeat'
                        : `Promote: ${targetClass?.name ?? 'Destination not set'}${targetSection ? `, Section ${targetSection.name}` : ''}`;
                  const feeLabel =
                    override.mode === 'current'
                      ? 'Current fee'
                      : override.mode === 'custom'
                        ? 'Custom fee'
                        : 'Class fee';
                  return (
                    <article
                      className="promotion-review__student"
                      key={student.id}
                    >
                      <div className="promotion-review__student-main">
                        <strong>
                          {student.firstName} {student.lastName}
                        </strong>
                        <small>{outcomeLabel}</small>
                      </div>
                      <div className="promotion-review__student-fee">
                        {mapping.outcome === 'graduated' ? (
                          <span>No new class fee</span>
                        ) : (
                          <>
                            <strong>{formatMoney(newFee)}</strong>
                            <small>{feeLabel}</small>
                          </>
                        )}
                      </div>
                      <div className="promotion-review__student-note">
                        {student.unpaidInvoiceCount > 0 ? (
                          <span>
                            {student.unpaidInvoiceCount} unpaid{' '}
                            {student.unpaidInvoiceCount === 1 ? 'fee' : 'fees'}.
                            {mapping.outcome === 'graduated'
                              ? ' They will be kept and still owed.'
                              : ' Existing invoices remain unchanged.'}
                          </span>
                        ) : (
                          <span>No unpaid fees to carry forward.</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="promotion-review__empty">No students selected.</p>
            )}
          </section>

          <div className="promotion-review__actions">
            <span>
              {selectedIds.length} selected of {preview?.students.length ?? 0}{' '}
              students
            </span>
            <button
              type="button"
              className="button button-primary"
              disabled={executeMutation.isPending || selectedIds.length === 0}
              onClick={() => setShowStartConfirmation(true)}
            >
              Start promotion
            </button>
          </div>
          {executeMutation.error && (
            <p role="alert">{errorText(executeMutation.error)}</p>
          )}
        </section>
      )}

      {showStartConfirmation && step === 4 && (
        <div
          className="promotion-confirm__backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setShowStartConfirmation(false);
          }}
        >
          <section
            className="promotion-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-confirm-title"
            aria-describedby="promotion-confirm-description"
          >
            <button
              type="button"
              className="promotion-confirm__close"
              aria-label="Close confirmation"
              onClick={() => setShowStartConfirmation(false)}
            >
              ×
            </button>
            <div className="promotion-confirm__title-row">
              <span aria-hidden="true">⚠</span>
              <h2 id="promotion-confirm-title">Start the promotion</h2>
            </div>
            <p id="promotion-confirm-description">
              {selectedIds.length} students will move from{' '}
              {preview?.sourceAcademicYear.name} to{' '}
              {preview?.targetAcademicYear.name}: {reviewCounts.promoted}{' '}
              promoted, {reviewCounts.repeating} repeating, 0 demoted, 0
              transferred and {reviewCounts.graduating} graduating. You can
              review the run in promotion history afterwards.
            </p>
            <div className="promotion-confirm__actions">
              <button
                type="button"
                className="button button-secondary"
                disabled={executeMutation.isPending}
                onClick={() => setShowStartConfirmation(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={executeMutation.isPending}
                onClick={() => {
                  setShowStartConfirmation(false);
                  executeMutation.mutate();
                }}
              >
                {executeMutation.isPending ? 'Starting…' : 'Start'}
              </button>
            </div>
          </section>
        </div>
      )}

      <footer
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
      >
        {step === 1 ? (
          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              navigate(`/admin/organizations/${organizationId}/admissions`)
            }
          >
            ← Cancel
          </button>
        ) : (
          <button
            type="button"
            className="button button-secondary"
            disabled={executeMutation.isPending}
            onClick={() =>
              setStep((current) => Math.max(1, current - 1) as Step)
            }
          >
            Back
          </button>
        )}
        {step < 4 && (
          <button
            type="button"
            className="button button-primary"
            disabled={
              (step === 1 &&
                (!campusId ||
                  !sourceAcademicYearId ||
                  !targetAcademicYearId ||
                  sourceAcademicYearId === targetAcademicYearId ||
                  previewQuery.isLoading ||
                  !activeStudents.length)) ||
              (step === 2 && previewQuery.isLoading) ||
              (step === 3 && (!activeStudents.length || previewQuery.isLoading))
            }
            onClick={next}
          >
            {step === 1 ? 'Next →' : 'Continue'}
          </button>
        )}
      </footer>
    </main>
  );
}

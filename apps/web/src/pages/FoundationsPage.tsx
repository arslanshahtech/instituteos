import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { DataTable } from '../components/ui/DataTable.js';
import { Dialog } from '../components/ui/Dialog.js';
import { FormField } from '../components/ui/FormField.js';
import { Pagination } from '../components/ui/Pagination.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useToast } from '../components/ui/ToastProvider.js';

const previewFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Enter at least two characters.')
    .max(40, 'Use 40 characters or fewer.'),
});

type PreviewFormValues = z.infer<typeof previewFormSchema>;

export function FoundationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { showToast } = useToast();
  const form = useForm<PreviewFormValues>({
    resolver: zodResolver(previewFormSchema),
    defaultValues: { displayName: '' },
  });

  const submitPreview = form.handleSubmit(() => {
    showToast('Form foundation submitted successfully.');
    form.reset();
  });

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Shared interface patterns</p>
          <h1>UI foundations</h1>
          <p className="page-description">
            Accessible, reusable building blocks for future InstituteOS
            workspaces.
          </p>
        </div>
      </section>

      <div className="foundation-grid">
        <section
          aria-labelledby="states-heading"
          className="panel foundation-card"
        >
          <div className="section-heading">
            <span className="section-kicker">01 · Feedback</span>
            <h2 id="states-heading">Page states</h2>
            <p>
              Consistent feedback for loading, empty, error, and restricted
              views.
            </p>
          </div>
          <div className="state-examples">
            <LoadingState message="Loading view…" />
            <EmptyState
              title="No results yet"
              description="New information will appear here when it is available."
            />
            <ErrorState
              title="Unable to load this view"
              description="Retry after checking your connection."
              onRetry={() => showToast('Retry requested.', 'info')}
            />
            <PermissionDeniedState />
          </div>
        </section>

        <section
          aria-labelledby="form-heading"
          className="panel foundation-card"
        >
          <div className="section-heading">
            <span className="section-kicker">02 · Forms</span>
            <h2 id="form-heading">Validated form</h2>
            <p>
              React Hook Form and Zod provide a typed validation foundation.
            </p>
          </div>
          <form className="preview-form" noValidate onSubmit={submitPreview}>
            <FormField
              autoComplete="off"
              error={form.formState.errors.displayName?.message}
              hint="This is an interaction preview; nothing is saved."
              label="Display name"
              placeholder="Enter a name"
              {...form.register('displayName')}
            />
            <Button
              disabled={form.formState.isSubmitting}
              type="submit"
              variant="primary"
            >
              Validate form
            </Button>
          </form>
        </section>

        <section
          aria-labelledby="table-heading"
          className="panel foundation-card foundation-card-wide"
        >
          <div className="section-heading">
            <span className="section-kicker">03 · Data display</span>
            <h2 id="table-heading">Table and pagination</h2>
            <p>Semantic table markup and paging controls are ready to reuse.</p>
          </div>
          <DataTable
            caption="Example data table"
            columns={[
              { header: 'Name', render: () => null },
              { header: 'Status', render: () => null },
              { header: 'Updated', render: () => null, align: 'right' },
            ]}
            rows={[]}
            rowKey={(_row, index) => index}
          />
          <Pagination
            currentPage={1}
            pageSize={10}
            totalItems={0}
            onPageChange={() => undefined}
          />
        </section>

        <section
          aria-labelledby="feedback-heading"
          className="panel foundation-card"
        >
          <div className="section-heading">
            <span className="section-kicker">04 · Actions</span>
            <h2 id="feedback-heading">Dialogs and notifications</h2>
            <p>
              Native dialog behavior and a shared, dismissible toast region.
            </p>
          </div>
          <div className="button-row">
            <Button onClick={() => setDialogOpen(true)} variant="secondary">
              Open dialog
            </Button>
            <Button
              onClick={() => showToast('Your preview notification is ready.')}
              variant="secondary"
            >
              Show notification
            </Button>
          </div>
        </section>
      </div>

      <Dialog
        description="Dialogs keep user actions focused and support the native Escape and focus behavior."
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title="Dialog foundation"
      >
        <p className="dialog-note">
          This dialog is a reusable interface preview.
        </p>
        <div className="dialog-actions">
          <Button onClick={() => setDialogOpen(false)} variant="primary">
            Done
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

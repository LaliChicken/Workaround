import { CalendarDays, FileText, PencilLine } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ImportDialog, type ImportResult } from '../components/ImportDialog';
import { Logo } from '../components/ui';
import { SAMPLE_OTHER_BLOCKS, emptySchedule, sampleSchedule } from '../data/sampleSchedule';
import { navigate } from '../lib/router';
import { useStore } from '../state/store';
import { SearchFields, StudentFields } from './ProfileView';

export function SetupView() {
  const { state, updateProfile, completeSetup } = useStore();
  const p = state.profile;
  const uid = useId();
  const [importStep, setImportStep] = useState<null | 'choose' | 'review'>(null);

  useEffect(() => {
    document.title = 'Get started · Workaround';
  }, []);

  const finish = (result: ImportResult) => {
    setImportStep(null);
    const base = sampleSchedule();
    // The sample keeps its example availability and commitments (the recorded demo relies on it);
    // an upload starts from the student's own classes and the availability they chose.
    const blocks =
      result.source === 'sample' ? [...result.classes, ...SAMPLE_OTHER_BLOCKS.map((b) => ({ ...b }))] : [...result.classes, ...(result.availability ?? [])];
    completeSetup({
      ...base,
      ...(result.term ? { termName: result.term.name ?? base.termName, termStart: result.term.start, termEnd: result.term.end } : {}),
      blocks,
    });
    navigate('/schedule');
  };

  return (
    <div className="setup">
      <div className="setup-card card">
        <Logo />
        <h1 className="setup-title">Find work that fits around class</h1>
        <p className="setup-lead">A few quick details, then your weekly schedule. Sample answers are filled in for this demo.</p>

        <form className="form" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label className="label" htmlFor={`${uid}-first`}>
              First name
            </label>
            <input id={`${uid}-first`} className="input" value={p.firstName} onChange={(e) => updateProfile({ firstName: e.target.value })} />
          </div>
          <StudentFields profile={p} onChange={updateProfile} />
          <SearchFields profile={p} onChange={updateProfile} />
        </form>

        <section className="setup-next" aria-labelledby="setup-next-title">
          <h2 id="setup-next-title">Next, your class schedule</h2>
          <p className="muted">You’ll confirm every class time before we use it to match jobs.</p>
          <div className="setup-options">
            <button type="button" className="setup-option is-primary" onClick={() => setImportStep('review')}>
              <CalendarDays size={22} aria-hidden="true" />
              <span>
                <strong>Use a sample timetable</strong>
                <small>Foothill classes, with example availability you can edit</small>
              </span>
            </button>
            <button type="button" className="setup-option" onClick={() => setImportStep('choose')}>
              <FileText size={22} aria-hidden="true" />
              <span>
                <strong>Upload my schedule</strong>
                <small>PDF, screenshot or photo, read by AI; you confirm every time</small>
              </span>
            </button>
            <button
              type="button"
              className="setup-option"
              onClick={() => {
                completeSetup(emptySchedule());
                navigate('/schedule');
              }}
            >
              <PencilLine size={22} aria-hidden="true" />
              <span>
                <strong>Enter classes myself</strong>
                <small>Start from an empty week</small>
              </span>
            </button>
          </div>
        </section>
      </div>

      {importStep && (
        <ImportDialog
          key={importStep}
          initialStep={importStep}
          baseSchedule={emptySchedule()}
          onClose={() => setImportStep(null)}
          onConfirm={finish}
          confirmLabel="Confirm and continue"
        />
      )}
    </div>
  );
}

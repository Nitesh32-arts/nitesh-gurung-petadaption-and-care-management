import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

const REMINDER_TYPES = [
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'checkup', label: 'Check-up' },
  { value: 'treatment', label: 'Treatment' },
  { value: 'medication', label: 'Medication' },
  { value: 'other', label: 'Other' },
];

export default function HealthReminderModal({ open, onClose, medicalRecords, onSubmit }) {
  const [recordId, setRecordId] = useState('');
  const [reminderType, setReminderType] = useState('checkup');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState('365');

  useEffect(() => {
    if (open) {
      // Reset form
      setRecordId('');
      setReminderType('checkup');
      setTitle('');
      setDescription('');
      setDueDate('');
      setReminderDate('');
      setIsRecurring(false);
      setRecurrenceInterval('365');
    }
  }, [open]);

  const canSubmit = useMemo(() => {
    if (!recordId || !reminderType || !title || !description || !dueDate || !reminderDate) {
      return false;
    }
    // Validate that reminder date is before or equal to due date
    if (reminderDate && dueDate && reminderDate > dueDate) {
      return false;
    }
    return true;
  }, [recordId, reminderType, title, description, dueDate, reminderDate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-xl rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Schedule Health Reminder</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Medical Record *</label>
            <select
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              className="mt-1 w-full border rounded-lg p-2"
            >
              <option value="">Select a medical record</option>
              {medicalRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.pet_info?.name || r.pet} — {r.record_type} — {r.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Choose the medical record this reminder is related to.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Reminder Type *</label>
              <select 
                value={reminderType} 
                onChange={(e) => setReminderType(e.target.value)} 
                className="mt-1 w-full border rounded-lg p-2"
              >
                {REMINDER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Title *</label>
              <input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="e.g., Annual rabies booster"
                className="mt-1 w-full border rounded-lg p-2" 
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Description *</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Detailed description of the reminder"
              className="mt-1 w-full border rounded-lg p-2" 
              rows={3} 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Reminder Date *</label>
              <input 
                value={reminderDate} 
                onChange={(e) => setReminderDate(e.target.value)} 
                type="date" 
                className="mt-1 w-full border rounded-lg p-2" 
              />
              <p className="text-xs text-gray-500 mt-1">
                When to send the reminder notification
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Due Date *</label>
              <input 
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)} 
                type="date" 
                className="mt-1 w-full border rounded-lg p-2" 
              />
              <p className="text-xs text-gray-500 mt-1">
                When the action is actually due
              </p>
            </div>
          </div>

          {reminderDate && dueDate && reminderDate > dueDate && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                Reminder date must be before or equal to due date.
              </p>
            </div>
          )}

          <div className="p-3 rounded-lg border bg-gray-50 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input 
                type="checkbox" 
                checked={isRecurring} 
                onChange={(e) => setIsRecurring(e.target.checked)} 
              />
              Recurring reminder
            </label>

            {isRecurring && (
              <div>
                <label className="text-sm font-medium text-gray-700">Recurrence Interval (days)</label>
                <input 
                  value={recurrenceInterval} 
                  onChange={(e) => setRecurrenceInterval(e.target.value)} 
                  type="number" 
                  min="1"
                  placeholder="365"
                  className="mt-1 w-full border rounded-lg p-2" 
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many days until the next reminder (e.g., 365 for annual)
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white p-4 border-t flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => onSubmit({
              medical_record: Number(recordId),
              reminder_type: reminderType,
              title,
              description,
              due_date: dueDate,
              reminder_date: reminderDate,
              is_recurring: isRecurring,
              recurrence_interval: isRecurring ? Number(recurrenceInterval) : null,
            })}
            className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark"
          >
            Schedule Reminder
          </button>
        </div>
      </div>
    </div>
  );
}


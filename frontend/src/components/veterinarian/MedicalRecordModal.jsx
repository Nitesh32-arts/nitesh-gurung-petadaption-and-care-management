import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

const RECORD_TYPES = [
  { value: 'checkup', label: 'Check-up' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'treatment', label: 'Treatment' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
];

const VACCINE_TYPES = [
  { value: 'rabies', label: 'Rabies' },
  { value: 'dhpp', label: 'DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)' },
  { value: 'bordetella', label: 'Bordetella' },
  { value: 'feline_leukemia', label: 'Feline Leukemia' },
  { value: 'feline_distemper', label: 'Feline Distemper (FVRCP)' },
  { value: 'other', label: 'Other' },
];

export default function MedicalRecordModal({ open, onClose, allPets, defaultPetId, onSubmit }) {
  const [petId, setPetId] = useState(defaultPetId || '');
  const [recordType, setRecordType] = useState('checkup');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [cost, setCost] = useState('');
  const [documents, setDocuments] = useState(null);

  // Vaccination (optional)
  const [vaccineType, setVaccineType] = useState('rabies');
  const [vaccineName, setVaccineName] = useState('');
  const [administeredDate, setAdministeredDate] = useState('');
  const [vaxNextDue, setVaxNextDue] = useState('');
  const [isBooster, setIsBooster] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setPetId(defaultPetId || '');
      // Reset form
      setRecordType('checkup');
      setTitle('');
      setDescription('');
      setDate('');
      setNextDueDate('');
      setCost('');
      setDocuments(null);
      setVaccineType('rabies');
      setVaccineName('');
      setAdministeredDate('');
      setVaxNextDue('');
      setIsBooster(false);
      setNotes('');
    }
  }, [open, defaultPetId]);

  const canSubmit = useMemo(() => {
    if (!petId || !recordType || !title || !description || !date) return false;
    if (recordType === 'vaccination') {
      return vaccineName && administeredDate && vaxNextDue;
    }
    return true;
  }, [petId, recordType, title, description, date, vaccineName, administeredDate, vaxNextDue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Create Medical Record</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Pet *</label>
            <select
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
              className="mt-1 w-full border rounded-lg p-2"
            >
              <option value="">Select a pet</option>
              {allPets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.pet_type}) — {p.shelter_info?.username || 'Owner'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select a pet to create a medical record. The pet will be assigned to you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Record Type *</label>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
                className="mt-1 w-full border rounded-lg p-2"
              >
                {RECORD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Date *</label>
              <input 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                type="date" 
                className="mt-1 w-full border rounded-lg p-2" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Title *</label>
              <input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="e.g., Annual check-up"
                className="mt-1 w-full border rounded-lg p-2" 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Next Check-up / Due Date</label>
              <input 
                value={nextDueDate} 
                onChange={(e) => setNextDueDate(e.target.value)} 
                type="date" 
                className="mt-1 w-full border rounded-lg p-2" 
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Description *</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Detailed description of the medical record"
              className="mt-1 w-full border rounded-lg p-2" 
              rows={3} 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Cost</label>
              <input 
                value={cost} 
                onChange={(e) => setCost(e.target.value)} 
                type="number" 
                step="0.01" 
                placeholder="0.00"
                className="mt-1 w-full border rounded-lg p-2" 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Documents</label>
              <input 
                onChange={(e) => setDocuments(e.target.files?.[0] || null)} 
                type="file" 
                className="mt-1 w-full" 
              />
            </div>
          </div>

          {recordType === 'vaccination' && (
            <div className="p-3 rounded-lg border bg-blue-50 space-y-3">
              <p className="text-sm font-medium text-gray-900">Vaccination Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Vaccine Type *</label>
                  <select 
                    value={vaccineType} 
                    onChange={(e) => setVaccineType(e.target.value)} 
                    className="mt-1 w-full border rounded-lg p-2"
                  >
                    {VACCINE_TYPES.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Vaccine Name *</label>
                  <input 
                    value={vaccineName} 
                    onChange={(e) => setVaccineName(e.target.value)} 
                    placeholder="e.g., Nobivac Rabies"
                    className="mt-1 w-full border rounded-lg p-2" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Administered Date *</label>
                  <input 
                    value={administeredDate} 
                    onChange={(e) => setAdministeredDate(e.target.value)} 
                    type="date" 
                    className="mt-1 w-full border rounded-lg p-2" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Next Due Date *</label>
                  <input 
                    value={vaxNextDue} 
                    onChange={(e) => setVaxNextDue(e.target.value)} 
                    type="date" 
                    className="mt-1 w-full border rounded-lg p-2" 
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input 
                  type="checkbox" 
                  checked={isBooster} 
                  onChange={(e) => setIsBooster(e.target.checked)} 
                />
                Booster shot
              </label>

              <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Additional notes"
                  className="mt-1 w-full border rounded-lg p-2" 
                  rows={2} 
                />
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white p-4 border-t flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => onSubmit({
              petId: petId ? Number(petId) : null,
              recordType,
              title,
              description,
              date,
              nextDueDate: nextDueDate || null,
              cost: cost || null,
              documents,
              vaccinationData: recordType === 'vaccination'
                ? {
                    vaccine_type: vaccineType,
                    vaccine_name: vaccineName,
                    administered_date: administeredDate,
                    next_due_date: vaxNextDue,
                    is_booster: isBooster,
                    notes,
                  }
                : null,
            })}
            className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark"
          >
            Create Record
          </button>
        </div>
      </div>
    </div>
  );
}


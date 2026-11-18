import { VetRecords } from '../../components/admin/VetRecords';
import { useAnimalTab } from './AnimalAdminPage';

// CU-34: pestaña «Veterinario» de la ficha del animal (SCREENS §5.4).
export function AnimalVetTab() {
  const { animal } = useAnimalTab();
  return <VetRecords animalId={animal.id} animalName={animal.name} />;
}

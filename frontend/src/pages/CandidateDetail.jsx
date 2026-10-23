import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { useStore } from '../store.jsx';
import { Actions, Asks, Contact, CVText, History, ProfileHeader, Rubric, ScorePanel } from '../components/CandidateProfile.jsx';
import { Card, Empty } from '../components/ui.jsx';

export default function CandidateDetail() {
  const { id } = useParams();
  const { candidates } = useStore();
  const c = candidates.find((x) => x.id === id);
  if (!c) return <Empty>Không tìm thấy hồ sơ {id}. <Link className="link" to="/ung-vien">Về danh sách ứng viên</Link></Empty>;

  return (
    <>
      <div className="page-head" style={{ marginBottom: 20 }}>
        <Link className="link" to="/ung-vien"><ArrowLeft size={16} /> Ứng viên</Link>
      </div>
      <div className="bento top">
        <Card span={8}>
          <ProfileHeader c={c} full />
          <ScorePanel c={c} />
          <Actions c={c} />
          <Rubric c={c} />
          <CVText c={c} />
        </Card>
        <Card span={4} className="sticky">
          <Asks c={c} />
          <Contact c={c} />
          <History c={c} />
        </Card>
      </div>
    </>
  );
}

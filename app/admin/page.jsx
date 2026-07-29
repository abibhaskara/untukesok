'use client';
import { FiUsers, FiDollarSign, FiActivity } from 'react-icons/fi';

export default function AdminDashboard() {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '32px', marginBottom: '8px' }}>Beranda Admin</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>Ringkasan aktivitas dan performa platform Untuk Esok.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        
        {/* Stat Card 1 */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e6f7ff', color: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              <FiUsers />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Total Relawan</p>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#333' }}>500+</h3>
            </div>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f6ffed', color: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              <FiDollarSign />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Total Donasi (Rp)</p>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#333' }}>12.5M</h3>
            </div>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fff0f6', color: '#eb2f96', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              <FiActivity />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Program Aktif</p>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#333' }}>12</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

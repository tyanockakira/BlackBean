import { Link } from 'react-router-dom'

export function BeanMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M31.4 7.3c5.8 5.2 5.4 15.3-1 22.5-6.4 7.3-16.2 9-22 3.8C2.6 28.4 3 18.3 9.4 11.1 15.8 3.8 25.6 2.1 31.4 7.3Z" stroke="currentColor" strokeWidth="2.5" />
      <path d="M8.4 33.6c4-6.2 12.3-7.8 13.6-14.1.8-4 2.6-8.8 9.4-12.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function Brand({ className = '', reloadDocument }) {
  return (
    <Link className={`brand ${className}`} to="/" reloadDocument={reloadDocument} aria-label="BLACK BEAN — на головну">
      <BeanMark className="brand-mark" />
      <span>BLACK<span className="brand-bean">BEAN</span></span>
    </Link>
  )
}

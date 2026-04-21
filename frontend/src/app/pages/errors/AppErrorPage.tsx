import React from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

function getErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        title: 'Page not found',
        detail: 'The page you opened does not exist or the link is no longer valid.',
      };
    }

    return {
      title: `${error.status} ${error.statusText}`,
      detail: typeof error.data === 'string' ? error.data : 'Something went wrong while opening this page.',
    };
  }

  if (error instanceof Error) {
    return {
      title: 'Something went wrong',
      detail: error.message,
    };
  }

  return {
    title: 'Something went wrong',
    detail: 'An unexpected error occurred while loading this page.',
  };
}

const AppErrorPage: React.FC = () => {
  const error = useRouteError();
  const { title, detail } = getErrorMessage(error);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,240,214,0.95),_rgba(251,247,240,0.96)_42%,_#f6f2eb_100%)] px-4 py-10 text-stone-900">
      <div className="mx-auto max-w-2xl rounded-[28px] border border-stone-200/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(120,83,38,0.12)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Hotel Pramod</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/public/book"
            className="inline-flex h-11 items-center rounded-2xl bg-stone-950 px-5 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            Open Public Booking
          </Link>
          <Link
            to="/"
            className="inline-flex h-11 items-center rounded-2xl border border-stone-300 px-5 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
          >
            Go To Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AppErrorPage;

import type { UIMatch } from 'react-router-dom';

const EmailTemplatePage = () => {
  return <div>Email Template Page</div>;
};

/**
 * Must return a non-empty string, so this shows the template key from the URL
 * rather than the label, which would need a request the breadcrumb cannot
 * wait for.
 */
export const handle = {
  breadcrumb: (match: UIMatch<unknown, unknown>) =>
    (match.params as { id?: string }).id ?? 'Template',
};

export default EmailTemplatePage;

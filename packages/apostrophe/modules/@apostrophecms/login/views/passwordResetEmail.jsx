// The JSX version of `passwordResetEmail.html`, used when the `jsx` option
// of @apostrophecms/template is set.
export default function ({ site, user, url }) {
  return (
    <>
      <h4>Resetting your password on {site}</h4>
      <p>Hello {user?.title},</p>
      <p>You are receiving this email because a request to reset your password was made on {site}.</p>
      <p>If that is your wish, please follow this link to complete the password reset process:</p>
      <p><a href={url ?? ''}>{url}</a></p>
      <p>
        If you did not request to reset your password, please delete and ignore this email. Someone else may have entered
        your email address in error.
      </p>
    </>
  );
}

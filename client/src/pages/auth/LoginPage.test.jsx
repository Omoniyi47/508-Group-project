import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { useAuth } from '../../context/useAuth';

vi.mock('../../context/useAuth', () => ({
  useAuth: vi.fn(),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  let loginMock;

  beforeEach(() => {
    loginMock = vi.fn();
    useAuth.mockReturnValue({ login: loginMock });
  });

  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('shows a validation error for a malformed email', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password$/i), 'somepassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('calls login with the entered credentials when the form is valid', async () => {
    loginMock.mockResolvedValue({ role: 'admin' });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email address/i), 'admin@university.edu');
    await user.type(screen.getByLabelText(/^password$/i), 'Admin@12345');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('admin@university.edu', 'Admin@12345');
    });
  });

  it('shows the server error message when login fails', async () => {
    loginMock.mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email address/i), 'admin@university.edu');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('shows and hides the password when the eye button is pressed', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

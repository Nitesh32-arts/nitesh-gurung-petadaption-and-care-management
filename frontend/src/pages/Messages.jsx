import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ConversationsList from '../components/ConversationsList';
import { useAuth } from '../hooks/useAuth';

const Messages = () => {
  const { user } = useAuth();
  const currentUserId = user?.id ?? user?.pk;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Messages</h1>
        <div className="min-h-[600px]">
          <ConversationsList
            currentUserId={currentUserId}
            onUnreadChange={() => {}}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Messages;

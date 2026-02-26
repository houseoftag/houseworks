import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';

export default async function CrmRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in');

  // Find the first workspace that has a CRM board
  const crmBoard = await prisma.board.findFirst({
    where: {
      boardType: 'CRM',
      workspace: { members: { some: { userId: session.user.id } } },
    },
    select: { workspaceId: true },
    orderBy: { createdAt: 'asc' },
  });

  if (crmBoard) {
    redirect(`/crm/${crmBoard.workspaceId}`);
  }

  // If no CRM board, redirect to first workspace
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    select: { workspaceId: true },
    orderBy: { createdAt: 'asc' },
  });

  if (membership) {
    redirect(`/crm/${membership.workspaceId}`);
  }

  redirect('/');
}

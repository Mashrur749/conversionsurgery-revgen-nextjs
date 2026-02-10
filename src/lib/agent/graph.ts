import { StateGraph, END } from '@langchain/langgraph';
import { ConversationState, ConversationStateType } from './state';
import { analyzeConversation } from './nodes/analyze';
import { decideAction } from './nodes/decide';
import { generateResponse } from './nodes/respond';

/**
 * Route after analysis - check if escalation needed
 */
function routeAfterAnalysis(state: ConversationStateType): string {
  if (state.needsEscalation) {
    return 'escalate';
  }
  return 'decide';
}

/**
 * Route after decision - what to do next
 */
function routeAfterDecision(state: ConversationStateType): string {
  switch (state.lastAction) {
    case 'respond':
    case 'book_appointment':
    case 'send_quote':
    case 'request_photos':
      return 'respond';

    case 'wait':
      return 'end'; // Don't respond, just wait

    case 'escalate':
      return 'escalate';

    case 'trigger_flow':
      return 'trigger_flow';

    case 'close_won':
    case 'close_lost':
      return 'close';

    case 'send_payment':
      return 'send_payment';

    default:
      return 'end';
  }
}

/**
 * Escalation handler node
 */
async function handleEscalation(
  state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  // Just mark for escalation - actual queue insertion happens in orchestrator
  return {
    needsEscalation: true,
    stage: 'escalated',
  };
}

/**
 * Flow trigger handler node
 */
async function handleTriggerFlow(
  _state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  // Flow trigger is handled by orchestrator
  return {};
}

/**
 * Close handler node
 */
async function handleClose(
  state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  const newStage = state.lastAction === 'close_won' ? 'booked' : 'lost';
  return {
    stage: newStage,
  };
}

/**
 * Payment link handler node
 */
async function handleSendPayment(
  _state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  // Payment link sending is handled by orchestrator
  return {};
}

/**
 * Build the conversation agent graph
 */
export function buildConversationGraph() {
  const graph = new StateGraph(ConversationState)
    // Add nodes
    .addNode('analyze', analyzeConversation)
    .addNode('decide', decideAction)
    .addNode('respond', generateResponse)
    .addNode('escalate', handleEscalation)
    .addNode('trigger_flow', handleTriggerFlow)
    .addNode('close', handleClose)
    .addNode('send_payment', handleSendPayment)

    // Set entry point
    .addEdge('__start__', 'analyze')

    // Route after analysis
    .addConditionalEdges('analyze', routeAfterAnalysis, {
      decide: 'decide',
      escalate: 'escalate',
    })

    // Route after decision
    .addConditionalEdges('decide', routeAfterDecision, {
      respond: 'respond',
      escalate: 'escalate',
      trigger_flow: 'trigger_flow',
      close: 'close',
      send_payment: 'send_payment',
      end: END,
    })

    // Terminal edges
    .addEdge('respond', END)
    .addEdge('escalate', END)
    .addEdge('trigger_flow', END)
    .addEdge('close', END)
    .addEdge('send_payment', END);

  return graph.compile();
}

// Export singleton instance
export const conversationAgent = buildConversationGraph();

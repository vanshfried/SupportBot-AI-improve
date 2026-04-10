import { useEffect, useState } from "react";
import API from "../../../API/api";

export default function AgentDashboard() {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    API.get("/analytics/agent-performance").then(res => {
      setAgents(res.data);
    });
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>📊 Agent Performance</h2>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Messages</th>
            <th>Closed Chats ✅</th>
          </tr>
        </thead>

        <tbody>
          {agents.map(agent => (
            <tr key={agent.id}>
              <td>{agent.name}</td>
              <td>{agent.role}</td>
              <td>{agent.message_count}</td>
              <td>{agent.conversations_closed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}